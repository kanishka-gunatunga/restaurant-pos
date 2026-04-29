const { Op } = require('sequelize');
const sequelize = require('../config/database');

const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const VariationOption = require('../models/VariationOption');
const Category = require('../models/Category');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit-table');
const PrintJob = require('../models/PrintJob');
const templateService = require('../services/templateService');

/**
 * Helper to resolve branchId based on user role
 */
const getBranchFilter = async (req, requestedBranch) => {
    // If user is admin and they requested 'all', return null (no filter)
    if (req.user.role === 'admin' && (!requestedBranch || requestedBranch === 'all')) {
        return null;
    }

    // If user is admin and requested a specific branch, return that
    if (req.user.role === 'admin' && requestedBranch && requestedBranch !== 'all') {
        return requestedBranch;
    }

    // For non-admin roles (manager, cashier, kitchen), force their assigned branch
    const detail = await UserDetail.findOne({ where: { userId: req.user.id } });
    return detail ? detail.branchId : -1; // -1 as fallback to return nothing if detail missing
};

/**
 * Helper to export data to Excel
 */
const exportToExcel = (res, fileName, data, summary) => {
    const wb = XLSX.utils.book_new();

    // Add Main Data Sheet
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Report Data");

    // Add Summary Sheet
    if (summary) {
        const summaryArr = Object.entries(summary).map(([key, value]) => ({ Metric: key, Value: value }));
        const wsSum = XLSX.utils.json_to_sheet(summaryArr);
        XLSX.utils.book_append_sheet(wb, wsSum, "Summary");
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
};

/**
 * Helper to export data to PDF
 */
const exportToPDF = async (res, title, headerInfo, tableHeaders, tableRows, summary) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).text(`Date Range: ${headerInfo.dateRange}`);
    doc.text(`Generated On: ${new Date().toLocaleString()}`);
    doc.moveDown();

    const table = {
        title: "Report Table",
        headers: tableHeaders.map(h => ({ label: h, property: h.toLowerCase().replace(/\s+/g, ''), width: 50 })),
        rows: tableRows.map(row => Object.values(row).map(v => String(v)))
    };

    // Since headers might be complex, we customize column width and labels
    const mappedHeaders = tableHeaders.map(h => h); // Placeholder

    await doc.table({
        title: title,
        subtitle: `Date Range: ${headerInfo.dateRange}`,
        headers: tableHeaders,
        rows: tableRows.map(r => Object.values(r).map(v => String(v))),
    }, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
        prepareRow: (row, i) => doc.font("Helvetica").fontSize(8),
    });

    if (summary) {
        doc.moveDown();
        doc.fontSize(12).text("Summary", { underline: true });
        Object.entries(summary).forEach(([key, value]) => {
            doc.fontSize(10).text(`${key}: ${value}`);
        });
    }

    doc.end();
};

/**
 * 1. Sales Report (Item-wise)
 */
exports.getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, branch, product, export: exportType } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Missing required parameters: startDate, endDate' });
        }

        const resolvedBranchId = await getBranchFilter(req, branch);

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const whereCondition = {
            createdAt: { [Op.between]: [start, end] },
            status: { [Op.ne]: 'cancel' }
        };

        if (resolvedBranchId) {
            whereCondition.branchId = resolvedBranchId;
        }

        const itemWhere = {};
        if (product && product !== 'all') {
            itemWhere.productId = product;
        }

        const orders = await Order.findAll({
            where: whereCondition,
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    where: itemWhere,
                    include: [
                        {
                            model: Product,
                            as: 'product',
                            include: [{ model: Category, as: 'category' }]
                        },
                        {
                            model: VariationOption,
                            as: 'variationOption',
                            include: [{ model: Variation, as: 'Variation' }]
                        }
                    ]
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['paymentMethod']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const itemSummaries = {};
        let totalGrossSalesAmount = 0;
        let totalDiscountsGiven = 0;
        let totalDeliveryCharges = 0;

        orders.forEach(order => {
            totalDeliveryCharges += parseFloat(order.deliveryChargeAmount || 0);
            const orderSubtotal = order.items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);

            order.items.forEach(item => {
                const productId = item.productId;
                const variationOptionId = item.variationOptionId || 0;
                const key = `${productId}_${variationOptionId}`;

                if (!itemSummaries[key]) {
                    const productName = item.product?.name || 'Unknown';
                    const vOpt = item.variationOption;
                    //  const variationName = vOpt ? (vOpt.Variation?.name ? `${vOpt.Variation.name}: ${vOpt.name}` : vOpt.name) : '';
                    // const fullName = variationName ? `${productName} (${variationName})` : productName;
                    const variationSuffix = vOpt?.name ? ` - ${vOpt.name}` : '';
                    const fullName = `${productName}${variationSuffix}`;

                    itemSummaries[key] = {
                        "Product No": item.product?.sku || item.product?.code || 'N/A',
                        "Product Name": fullName,
                        "Category": item.product?.category?.name || 'Uncategorized',
                        "Qty Sold": 0,
                        "Unit Price": parseFloat(item.unitPrice),
                        "Discount": 0,
                        "Total Amount": 0
                    };
                }

                const itemSubtotal = parseFloat(item.unitPrice) * item.quantity;
                const itemDiscount = parseFloat(item.productDiscount || 0) * item.quantity;
                const totalAmount = itemSubtotal - itemDiscount;

                itemSummaries[key]["Qty Sold"] += item.quantity;
                itemSummaries[key]["Discount"] += itemDiscount;
                itemSummaries[key]["Total Amount"] += totalAmount;

                totalGrossSalesAmount += itemSubtotal;
                totalDiscountsGiven += itemDiscount;
            });
        });

        // Filter and round values
        const reportData = Object.values(itemSummaries)
            .filter(item => item["Qty Sold"] > 0)
            .map(item => ({
                ...item,
                "Total Amount": item["Total Amount"].toFixed(2)
            }));

        const summary = {
            "Total Sales (Before Discount)": totalGrossSalesAmount.toFixed(2),
            "Total Discounts Given": totalDiscountsGiven.toFixed(2),
            "Total Delivery Charges": totalDeliveryCharges.toFixed(2),
            "Final Total": (totalGrossSalesAmount - totalDiscountsGiven + totalDeliveryCharges).toFixed(2)
        };

        if (exportType === 'excel') {
            return exportToExcel(res, "Sales_Report_Item_Wise", reportData, summary);
        } else if (exportType === 'pdf') {
            const headers = ["Product No", "Product Name", "Category", "Qty Sold", "Unit Price", "Discount", "Total Amount"];
            return exportToPDF(res, "Sales Report (Item-Wise)", { dateRange: `${startDate} to ${endDate}` }, headers, reportData, summary);
        }

        if (req.query.print === 'true') {
            try {
                // Optimization: Use resolvedBranchId from earlier or default to 1
                const branchIdToUse = resolvedBranchId && resolvedBranchId !== -1 ? resolvedBranchId : 1;
                const branchRecord = await Branch.findByPk(branchIdToUse);

                const headerInfo = {
                    reportName: 'Sales Report',
                    dateRange: `${startDate} to ${endDate}`,
                    generatedOn: new Date()
                };

                const data = templateService.generateSalesReportStructuredData(reportData, summary, headerInfo, branchRecord);
                const content = JSON.stringify(data);

                await PrintJob.create({
                    order_id: null, // Summary reports are not tied to a specific order
                    printer_name: 'XP-80',
                    content,
                    type: 'sales_report',
                    status: 'pending'
                });

                res.json({
                    success: true,
                    message: 'Sales report has been sent to the printer successfully.',
                    printJobType: 'sales_report'
                });
            } catch (printError) {
                console.error('[ReportController] Failed to queue sales report print job:', printError);
                res.status(500).json({ message: 'Failed to queue print job: ' + printError.message });
            }
        } else {
            res.json({
                header: {
                    reportName: 'Sales Report',
                    dateRange: `${startDate} to ${endDate}`,
                    generatedOn: new Date()
                },
                data: reportData,
                summary: summary
            });
        }

    } catch (error) {
        console.error('Sales Report Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 2. Orders Report
 */
exports.getOrdersReport = async (req, res) => {
    try {
        const { startDate, endDate, branch, export: exportType } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Missing required parameters: startDate, endDate' });
        }

        const resolvedBranchId = await getBranchFilter(req, branch);

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const whereCondition = {
            createdAt: { [Op.between]: [start, end] }
        };

        if (resolvedBranchId) {
            whereCondition.branchId = resolvedBranchId;
        }

        const orders = await Order.findAll({
            where: whereCondition,
            include: [
                { model: Customer, as: 'customer' },
                { model: OrderItem, as: 'items', attributes: ['id'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        let totalOrders = orders.length;
        let completedOrders = 0;
        let cancelledOrders = 0;
        let totalOrderValue = 0;

        const reportData = orders.map(order => {
            const subtotal = parseFloat(order.totalAmount) - parseFloat(order.tax || 0) + parseFloat(order.orderDiscount || 0);
            if (order.status === 'complete') completedOrders++;
            if (order.status === 'cancel') cancelledOrders++;
            totalOrderValue += parseFloat(order.totalAmount);

            return {
                "Order ID":order.id,
                "Order No": order.orderNo,
                "Order Date": new Date(order.createdAt).toLocaleDateString(),
                "Customer Name": order.customer?.name || 'Guest',
                "Order Type": order.orderType,
                "Items Count": order.items?.length || 0,
                "Order Status": order.status,
                "Subtotal": subtotal.toFixed(2),
                "Discount": order.orderDiscount,
                "Tax": order.tax,
                "Total Amount": order.totalAmount
            };
        });

        const summary = {
            "Total Orders": totalOrders,
            "Completed Orders": completedOrders,
            "Cancelled Orders": cancelledOrders,
            "Total Order Value": totalOrderValue.toFixed(2),
            "Average Order Value": totalOrders > 0 ? (totalOrderValue / totalOrders).toFixed(2) : 0
        };

        if (exportType === 'excel') {
            return exportToExcel(res, "Orders_Report", reportData, summary);
        } else if (exportType === 'pdf') {
            const headers = ["Order ID", "Order Date", "Customer Name", "Order Type", "Items Count", "Order Status", "Subtotal", "Discount", "Tax", "Total Amount"];
            return exportToPDF(res, "Orders Report", { dateRange: `${startDate} to ${endDate}` }, headers, reportData, summary);
        }

        res.json({
            header: {
                reportName: 'Orders Report',
                dateRange: `${startDate} to ${endDate}`,
                generatedOn: new Date()
            },
            data: reportData,
            summary: summary
        });

    } catch (error) {
        console.error('Orders Report Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 3. Payment Report
 */
exports.getPaymentsReport = async (req, res) => {
    try {
        const { startDate, endDate, branch, export: exportType } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Missing required parameters: startDate, endDate' });
        }

        const resolvedBranchId = await getBranchFilter(req, branch);

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const orderWhere = {};
        if (resolvedBranchId) {
            orderWhere.branchId = resolvedBranchId;
        }

        const payments = await Payment.findAll({
            where: {
                createdAt: { [Op.between]: [start, end] }
            },
            include: [
                {
                    model: Order,
                    as: 'order',
                    where: orderWhere,
                    attributes: ['id', 'branchId', 'orderNo']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        let totalPaymentsReceived = 0;

        const reportData = payments.map(payment => {
            totalPaymentsReceived += parseFloat(payment.amount);
            return {
                "Payment ID": payment.id,
                "Date": new Date(payment.createdAt).toLocaleDateString(),
                "Invoice No": payment.order?.id || 'N/A',
                "Order No": payment.order?.orderNo || 'N/A',
                "Payment Method": payment.paymentMethod,
                "Amount Paid": payment.amount,
                "Status": payment.status
            };
        });

        const summary = {
            "Total Payments Received": totalPaymentsReceived.toFixed(2)
        };

        if (exportType === 'excel') {
            return exportToExcel(res, "Payment_Report", reportData, summary);
        } else if (exportType === 'pdf') {
            const headers = ["Payment ID", "Date", "Invoice No", "Payment Method", "Amount Paid", "Status"];
            return exportToPDF(res, "Payment Report", { dateRange: `${startDate} to ${endDate}` }, headers, reportData, summary);
        }

        res.json({
            header: {
                reportName: 'Payment Report',
                dateRange: `${startDate} to ${endDate}`,
                generatedOn: new Date()
            },
            data: reportData,
            summary: summary
        });

    } catch (error) {
        console.error('Payment Report Error:', error);
        res.status(500).json({ message: error.message });
    }
};


/**
 * 4. Product Performance Report
 */
exports.getProductPerformanceReport = async (req, res) => {
    try {
        const { startDate, endDate, branch, export: exportType } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Missing required parameters: startDate, endDate' });
        }

        const resolvedBranchId = await getBranchFilter(req, branch);

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const orderWhere = {
            createdAt: { [Op.between]: [start, end] },
            status: { [Op.ne]: 'cancel' }
        };

        if (resolvedBranchId) {
            orderWhere.branchId = resolvedBranchId;
        }

        const items = await OrderItem.findAll({
            include: [
                {
                    model: Order,
                    where: orderWhere,
                    attributes: []
                },
                {
                    model: Product,
                    as: 'product',
                    attributes: ['name']
                }
            ],
            attributes: [
                'productId',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantitySold'],
                [sequelize.literal('SUM(quantity * unitPrice - productDiscount)'), 'totalSales']
            ],
            group: ['OrderItem.productId', 'product.id'],
            order: [[sequelize.literal('totalSales'), 'DESC']]
        });

        let totalItemsSold = 0;
        let grandTotalSales = 0;

        const reportData = items.map(item => {
            const qty = parseInt(item.getDataValue('totalQuantitySold') || 0);
            const sales = parseFloat(item.getDataValue('totalSales') || 0);

            totalItemsSold += qty;
            grandTotalSales += sales;

            return {
                "Product Name": item.product?.name || 'Unknown',
                "Total Quantity Sold": qty,
                "Total Sales (Rs)": sales.toFixed(2)
            };
        });

        const summary = {
            "Total Items Sold": totalItemsSold,
            "Grand Total Sales": `Rs. ${grandTotalSales.toFixed(2)}`
        };

        if (exportType === 'excel') {
            return exportToExcel(res, "Product_Performance_Report", reportData, summary);
        } else if (exportType === 'pdf') {
            const headers = ["Product Name", "Total Quantity Sold", "Total Sales (Rs)"];
            return exportToPDF(res, "Product Performance Report", { dateRange: `${startDate} to ${endDate}` }, headers, reportData, summary);
        }

        res.json({
            header: {
                reportName: 'Product Performance Report',
                dateRange: `${startDate} to ${endDate}`,
                generatedOn: new Date()
            },
            data: reportData,
            summary: summary
        });

    } catch (error) {
        console.error('Product Performance Report Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 5. Itemized Sales List (No Aggregation)
 */
exports.getItemizedSalesList = async (req, res) => {
    try {
        const { startDate, endDate, branch, product, export: exportType } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Missing required parameters: startDate, endDate' });
        }

        const resolvedBranchId = await getBranchFilter(req, branch);

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const whereCondition = {
            createdAt: { [Op.between]: [start, end] },
            status: { [Op.ne]: 'cancel' }
        };

        if (resolvedBranchId) {
            whereCondition.branchId = resolvedBranchId;
        }

        const itemWhere = {};
        if (product && product !== 'all') {
            itemWhere.productId = product;
        }

        const orders = await Order.findAll({
            where: whereCondition,
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    where: itemWhere,
                    include: [
                        {
                            model: Product,
                            as: 'product',
                            include: [{ model: Category, as: 'category' }]
                        },
                        {
                            model: VariationOption,
                            as: 'variationOption',
                            include: [{ model: Variation, as: 'Variation' }]
                        }
                    ]
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: ['paymentMethod']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const reportData = [];
        let totalGrossSalesAmount = 0;
        let totalDiscountsGiven = 0;
        let totalDeliveryCharges = 0;

        orders.forEach(order => {
            totalDeliveryCharges += parseFloat(order.deliveryChargeAmount || 0);
            const orderSubtotal = order.items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);

            order.items.forEach(item => {
                const productName = item.product?.name || 'Unknown';
                const vOpt = item.variationOption;
                const variationSuffix = vOpt?.name ? ` - ${vOpt.name}` : '';
                const fullName = `${productName}${variationSuffix}`;

                const itemSubtotal = parseFloat(item.unitPrice) * item.quantity;
                const itemDiscount = parseFloat(item.productDiscount || 0) * item.quantity;
                
                const totalAmount = itemSubtotal - itemDiscount;

                reportData.push({
                    "Order ID": order.id,
                    "Order No": order.orderNo,
                    "Date": new Date(order.createdAt).toLocaleString(),
                    "Product No": item.product?.sku || item.product?.code || 'N/A',
                    "Product Name": fullName,
                    "Category": item.product?.category?.name || 'Uncategorized',
                    "Qty Sold": item.quantity,
                    "Unit Price": parseFloat(item.unitPrice).toFixed(2),
                    "Subtotal": itemSubtotal.toFixed(2),
                    "Discount": itemDiscount.toFixed(2),
                    "Total Amount": totalAmount.toFixed(2),
                    "Payment Method": order.payments && order.payments.length > 0 ? order.payments.map(p => p.paymentMethod).join(', ') : 'N/A'
                });

                totalGrossSalesAmount += itemSubtotal;
                totalDiscountsGiven += itemDiscount;
            });
        });

        const summary = {
            "Total Sales (Before Discount)": totalGrossSalesAmount.toFixed(2),
            "Total Discounts Given": totalDiscountsGiven.toFixed(2),
            "Total Delivery Charges": totalDeliveryCharges.toFixed(2),
            "Final Total": (totalGrossSalesAmount - totalDiscountsGiven + totalDeliveryCharges).toFixed(2)
        };

        if (exportType === 'excel') {
            return exportToExcel(res, "Itemized_Sales_List", reportData, summary);
        } else if (exportType === 'pdf') {
            const headers = ["Order ID", "Date", "Product No", "Product Name", "Category", "Qty Sold", "Unit Price", "Subtotal", "Discount", "Total Amount", "Payment Method"];
            return exportToPDF(res, "Itemized Sales List", { dateRange: `${startDate} to ${endDate}` }, headers, reportData, summary);
        }

        res.json({
            header: {
                reportName: 'Itemized Sales List',
                dateRange: `${startDate} to ${endDate}`,
                generatedOn: new Date()
            },
            data: reportData,
            summary: summary
        });

    } catch (error) {
        console.error('Itemized Sales List Error:', error);
        res.status(500).json({ message: error.message });
    }
};

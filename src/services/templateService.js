/**
 * Service to generate receipt HTML templates.
 */
const formatOrderReference = (order) => order?.orderNo || order?.receipt_no || order?.id?.toString().padStart(8, '0') || 'N/A';
const resolveOrderTableLabel = (order) => order?.table?.table_name || order?.tableName || order?.tableNumber || 'N/A';

exports.generateReceiptHtml = (order, payment, branch) => {
    const pad = (str, len, char = ' ', right = false) => {
        str = String(str);
        if (str.length >= len) return str;
        const padding = char.repeat(len - str.length);
        return right ? padding + str : str + padding;
    };

    const width = 48; // Updated for 80mm thermal printer (typical 48/56 chars)

    const itemsHtml = order.items.map(item => {
        let modificationsHtml = '';
        if (item.modifications && item.modifications.length > 0) {
            modificationsHtml = item.modifications.map(mod => {
                const modName = `- ${mod.modification?.name || mod.modification?.title || 'Extra'}`;
                return `<div style="font-size: 0.9em; margin-left: 10px;">${modName}</div>`;
            }).join('');
        }

        const name = item.productBundle?.name || item.bogoPromotion?.name || item.product?.name || 'Item';
        const vOpt = item.variationOption || item.variation_option;
        const variationSummary = vOpt ? (vOpt.Variation?.name ? `${vOpt.Variation.name}: ${vOpt.name}` : vOpt.name) : '';
        const variation = variationSummary ? `(${variationSummary})` : '';
        const fullName = `${name} ${variation}`;
        const price = parseFloat(item.unitPrice).toFixed(2);
        const qty = parseFloat(item.quantity).toFixed(2);
        const amount = (item.quantity * item.unitPrice).toFixed(2);

        return `
            <div style="margin-bottom: 5px; display: flex; align-items: flex-start;">
                <div style="flex: 2; text-align: left; padding-right: 5px; font-weight: bold;">${fullName}</div>
                <div style="flex: 1; text-align: right; width: 80px;">${price}</div>
                <div style="flex: 0.8; text-align: right; width: 50px;">${qty}</div>
                <div style="flex: 1.2; text-align: right; width: 100px;">${amount}</div>
            </div>
            ${modificationsHtml}
        `;
    }).join('');

    const totalDiscount = parseFloat(order.orderDiscount || 0);
    const totalQty = order.items.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toFixed(2);
    const subTotal = (parseFloat(order.totalAmount || 0)).toFixed(2);
    const date = new Date(order.createdAt);

    return `
        <div style="width: 550px; font-family: 'Courier New', Courier, monospace; font-size: 15px; line-height: 1.3; color: #000; background: #fff; padding: 10px;">
            <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 1.6em; font-weight: bold; text-transform: uppercase;">CATERING BY AHAS GAWWA</div>
                <div style="font-size: 1.1em;">${branch?.location || 'No. 226, Arakawila, Handapangoda'}</div>
                <div style="font-size: 1.1em;">${branch?.mobile || '0112175275'}</div>
            </div>
            
            <div style="border-top: 1px solid #000; margin: 4px 0;"></div>
            <div style="display: flex; justify-content: flex-end; font-weight: bold; font-size: 1.2em;"><span>${formatOrderReference(order)}</span></div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>CASHIER: ${order.user?.name || 'Staff'}</span>
                <span>UNIT: ${branch?.id || '1'}</span>
            </div>

            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; font-weight: bold; text-transform: uppercase;">
                <span style="flex: 2;">PRODUCT</span>
                <span style="flex: 1; text-align: right;">PRICE</span>
                <span style="flex: 0.8; text-align: right;">QTY</span>
                <span style="flex: 1.2; text-align: right;">AMOUNT</span>
            </div>

            <div style="text-align: center; margin: 8px 0; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px;">Original</div>

            <div style="margin-bottom: 10px;">
                ${itemsHtml}
                ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px;">
                    <span>Promotion Discount</span>
                    <span>-${totalDiscount.toFixed(2)}</span>
                </div>` : ''}
                <div style="border-top: 1px solid #000; margin: 10px 0;"></div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; font-size: 1.3em; font-weight: bold;">
                    <span>SUB TOTAL</span>
                    <span>${subTotal}</span>
                </div>
            </div>

            <div style="margin-bottom: 15px; border-top: 1px dashed #000; padding-top: 8px;">
                ${(order.payments && order.payments.length > 0) ? order.payments.map(p => `
                <div style="display: flex; justify-content: space-between; font-size: 1.1em; margin-bottom: 4px;">
                    <span>
                        ${(p.paymentMethod || 'CASH').toUpperCase()}
                        ${p.cardType ? `(${p.cardType})` : ''}
                        ${p.cardLastFour ? ` **** ${p.cardLastFour}` : ''}
                    </span>
                    <span>${parseFloat(p.amount).toFixed(2)}</span>
                </div>
                `).join('') : `
                <div style="display: flex; justify-content: space-between; font-size: 1.2em;">
                    <span>${(payment?.paymentMethod || 'CASH').toUpperCase()}</span>
                    <span>${parseFloat(payment?.paidAmount || payment?.amount || subTotal).toFixed(2)}</span>
                </div>
                `}
                
                <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 1.1em;">
                        <span>TOTAL PAID</span>
                        <span>${(order.payments && order.payments.length > 0 ? order.payments.reduce((s, p) => s + parseFloat(p.paidAmount || p.amount), 0) : parseFloat(payment?.paidAmount || payment?.amount || subTotal)).toFixed(2)}</span>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.3em; margin-top: 4px;">
                    <span>BALANCE</span>
                    <span>${Math.max(0, (order.payments && order.payments.length > 0 ? order.payments.reduce((s, p) => s + parseFloat(p.paidAmount || p.amount), 0) : parseFloat(payment?.paidAmount || payment?.amount || subTotal)) - parseFloat(subTotal)).toFixed(2)}</span>
                </div>
                ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-weight: bold;">
                    <span>Your savings                    Rs.</span>
                    <span>${totalDiscount.toFixed(2)}</span>
                </div>` : ''}
            </div>

            <div style="margin-bottom: 15px;">
                ${parseFloat(order.serviceCharge || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 1.1em;">
                    <span>SERVICE CHARGE</span>
                    <span>${parseFloat(order.serviceCharge).toFixed(2)}</span>
                </div>` : ''}
                ${parseFloat(order.deliveryChargeAmount || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 1.1em;">
                    <span>DELIVERY CHARGE</span>
                    <span>${parseFloat(order.deliveryChargeAmount).toFixed(2)}</span>
                </div>` : ''}
            </div>

            <div style="border-top: 1px solid #000; margin: 10px 0;"></div>

            <div style="margin-bottom: 10px; font-size: 0.95em;">
                <div style="display: flex; justify-content: space-between;">
                    <span>NO OF ITEMS: ${order.items.length}</span>
                    <span>TOTAL QTY: ${totalQty}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span>DATE: ${date.toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo' })}</span>
                    <span>TIME: ${date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo' })}</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px;">
                <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 4px;">THANK YOU COME AGAIN</div>
                <div style="font-size: 0.9em;">SOFTWARE BY SLTMobitel</div>
            </div>
        </div>
    `;
};

exports.generateKitchenReceiptHtml = (order, branch) => {
    const date = new Date(order.createdAt);
    const totalQty = order.items.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toFixed(2);

    const itemsHtml = order.items.map(item => {
        let modificationsHtml = '';
        if (item.modifications && item.modifications.length > 0) {
            modificationsHtml = item.modifications.map(mod => {
                const modName = `- ${mod.modification?.name || mod.modification?.title || 'Extra'}`;
                return `<div style="font-size: 1.1em; margin-left: 20px; font-weight: bold;">${modName}</div>`;
            }).join('');
        }

        const name = (item.productBundle?.name || item.bogoPromotion?.name || item.product?.name || 'Item').substring(0, 25);
        const vOpt = item.variationOption || item.variation_option;
        const variationSummary = vOpt ? (vOpt.Variation?.name ? `${vOpt.Variation.name}: ${vOpt.name}` : vOpt.name) : '';
        const variation = variationSummary ? `(${variationSummary})` : '';
        const qty = parseFloat(item.quantity).toFixed(2);

        return `
            <div style="margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 1.3em; font-weight: bold;">
                    <span>${qty} x ${name} ${variation}</span>
                </div>
                ${modificationsHtml}
            </div>
        `;
    }).join('');

    return `
        <div style="width: 550px; font-family: 'Courier New', Courier, monospace; line-height: 1.2; color: #000; background: #fff; padding: 10px;">
            <div style="text-align: center; border: 2px solid #000; padding: 5px; margin-bottom: 10px;">
                <div style="font-size: 1.8em; font-weight: bold; text-transform: uppercase;">KITCHEN COPY</div>
                <div style="font-size: 1.2em;">Order #${formatOrderReference(order)}</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; font-size: 1.1em;">
                <span>TYPE: ${order.orderType || 'N/A'}</span>
                <span>TABLE: ${resolveOrderTableLabel(order)}</span>
            </div>

            <div style="margin-bottom: 10px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0;">
                <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 5px;">ITEMS TO PREPARE:</div>
                ${itemsHtml}
            </div>

            ${order.kitchenNote ? `
            <div style="margin-bottom: 10px; border: 1px solid #000; padding: 5px;">
                <div style="font-weight: bold; text-decoration: underline;">KITCHEN NOTE:</div>
                <div style="font-size: 1.2em; font-weight: bold;">${order.kitchenNote}</div>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; border-top: 1px dashed #000; padding-top: 5px;">
                <span>TOTAL QTY: ${totalQty}</span>
                <span>ITEMS: ${order.items.length}</span>
            </div>

            <div style="margin-top: 10px; font-size: 0.9em; text-align: center;">
                <div>TIME: ${date.toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}</div>
            </div>
        </div>
    `;
};

/**
 * Capitalize first letter helper
 */
const capitalize = (str) => {
    if (!str) return str;
    const s = String(str).toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Helper to format date as local YYYY-MM-DD HH:mm:ss
 */
const formatDateTime = (date) => {
    if (!date) return date;
    const d = new Date(date);

    try {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Colombo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(d);
        const map = {};
        parts.forEach(p => map[p.type] = p.value);

        return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
    } catch (e) {
        // Fallback to old behavior if Intl fails
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
};

/**
 * Generate structured JSON for payment receipts (for ESC/POS)
 */
exports.generateReceiptStructuredData = (order, payment, branch) => {
    return {
        type: 'receipt',
        orderId: order.id.toString().padStart(8, '0'),
        orderNo: order.orderNo,
        orderType: capitalize(order.orderType || 'N/A'),
        dateTime: formatDateTime(order.createdAt),
        cashier: order.user?.name || 'Staff',
        unit: String(branch?.id || '1'),
        customerName: order.customer?.name,
        customerMobile: order.customer?.mobile,
        branch: {
            name: 'CATERING BY AHAS GAWWA',
            location: branch?.location || 'No. 226, Arakawila, Handapangoda',
            mobile: branch?.mobile || '011 2 175 275'
        },
        items: order.items.map(item => {
            const name = item.productBundle?.name || item.bogoPromotion?.name || item.product?.name || 'Item';
            const vOpt = item.variationOption || item.variation_option;
            const variationSummary = vOpt ? (vOpt.Variation?.name ? `${vOpt.Variation.name}: ${vOpt.name}` : vOpt.name) : '';

            return {
                name: name,
                variation: variationSummary,
                price: parseFloat(item.unitPrice).toFixed(2),
                qty: parseFloat(item.quantity).toFixed(2),
                amount: (item.quantity * item.unitPrice).toFixed(2),
                modifications: item.modifications?.map(mod =>
                    mod.modification?.name || mod.modification?.title || 'Extra'
                ) || []
            };
        }),
        totals: {
            subTotal: (parseFloat(order.totalAmount || 0) + parseFloat(order.orderDiscount || 0) - parseFloat(order.serviceCharge || 0) - parseFloat(order.deliveryChargeAmount || 0)).toFixed(2),
            discount: parseFloat(order.orderDiscount || 0).toFixed(2),
            serviceCharge: parseFloat(order.serviceCharge || 0).toFixed(2),
            deliveryCharge: parseFloat(order.deliveryChargeAmount || 0).toFixed(2),
            total: (parseFloat(order.totalAmount || 0)).toFixed(2)
        },
        payment: {
            method: capitalize(payment?.paymentMethod || 'Cash'),
            paidAmount: parseFloat(payment?.paidAmount || payment?.amount || order.totalAmount).toFixed(2),
            amount: parseFloat(payment?.amount || order.totalAmount).toFixed(2),
            balance: Math.max(0, parseFloat(payment?.paidAmount || payment?.amount || order.totalAmount) - parseFloat(order.totalAmount || 0)).toFixed(2)
        },
        payments: (order.payments && order.payments.length > 0) ? order.payments.map(p => ({
            method: capitalize(p.paymentMethod || 'Cash'),
            amount: parseFloat(p.amount).toFixed(2),
            paidAmount: parseFloat(p.paidAmount || p.amount).toFixed(2),
            cardType: p.cardType,
            cardLastFour: p.cardLastFour
        })) : [{
            method: capitalize(payment?.paymentMethod || 'Cash'),
            amount: parseFloat(payment?.amount || order.totalAmount).toFixed(2),
            paidAmount: parseFloat(payment?.paidAmount || payment?.amount || order.totalAmount).toFixed(2)
        }]
    };
};

/**
 * Generate structured JSON for kitchen receipts (for ESC/POS)
 */
exports.generateKitchenStructuredData = (order, branch) => {
    return {
        type: 'kitchen',
        orderId: order.id.toString().padStart(8, '0'),
        orderNo: order.orderNo,
        dateTime: formatDateTime(order.createdAt),
        orderType: capitalize(order.orderType || 'N/A'),
        tableNumber: resolveOrderTableLabel(order),
        kitchenNote: order.kitchenNote,
        items: order.items.map(item => {
            const name = item.productBundle?.name || item.bogoPromotion?.name || item.product?.name || 'Item';
            const vOpt = item.variationOption || item.variation_option;
            const variationSummary = vOpt ? (vOpt.Variation?.name ? `${vOpt.Variation.name}: ${vOpt.name}` : vOpt.name) : '';

            return {
                name: name,
                variation: variationSummary,
                qty: parseFloat(item.quantity).toFixed(2),
                modifications: item.modifications?.map(mod =>
                    mod.modification?.name || mod.modification?.title || 'Extra'
                ) || []
            };
        })
    };
};

/**
 * Generate structured JSON for Sales Report (for ESC/POS)
 */
exports.generateSalesReportStructuredData = (reportData, summary, headerInfo, branch) => {
    return {
        type: 'sales_report',
        reportName: headerInfo.reportName || 'Sales Report',
        dateRange: headerInfo.dateRange,
        generatedOn: formatDateTime(headerInfo.generatedOn || new Date()),
        branch: {
            name: 'CATERING BY AHAS GAWWA',
            location: branch?.location || 'No. 226, Arakawila, Handapangoda',
            mobile: branch?.mobile || '0112175275'
        },
        summary: {
            totalSalesAmount: summary["Total Sales (Before Discount)"],
            totalDiscountsGiven: summary["Total Discounts Given"],
            totalDeliveryCharges: summary["Total Delivery Charges"],
            netSales: summary["Final Total"],
            normalSales: summary["Normal Customer Sales"],
            staffSales: summary["Staff Sales"],
            managementSales: summary["Management Sales"]
        },
        data: reportData.map(item => ({
            date: item["Date"],
            invoiceNo: item["Invoice No"],
            productName: item["Product Name"],
            customerCategory: item["Customer Category"],
            qtySold: item["Qty Sold"],
            totalAmount: item["Total Amount"]
        }))
    };
};

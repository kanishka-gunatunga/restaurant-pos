/**
 * Service to generate receipt HTML templates.
 */
exports.generateReceiptHtml = (order, payment, branch) => {
    const itemsHtml = order.items.map(item => {
        let modificationsHtml = '';
        if (item.modifications && item.modifications.length > 0) {
            modificationsHtml = item.modifications.map(mod => 
                `<div style="font-size: 0.8em; margin-left: 10px;">+ ${mod.modification?.name || 'Extra'} (Rs.${mod.price})</div>`
            ).join('');
        }

        return `
            <div style="margin-bottom: 5px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${item.quantity} x ${item.product?.name} ${item.variation?.name ? '(' + item.variation.name + ')' : ''}</span>
                    <span>Rs.${(item.quantity * item.unitPrice).toFixed(2)}</span>
                </div>
                ${modificationsHtml}
            </div>
        `;
    }).join('');

    return `
        <div style="width: 300px; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 1.2;">
            <div style="text-align: center; margin-bottom: 10px;">
                <h2 style="margin: 0;">${branch?.name || 'Restaurant POS'}</h2>
                <p style="margin: 2px 0;">${branch?.location || ''}</p>
                <hr style="border: none; border-top: 1px dashed #000; margin: 5px 0;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <p style="margin: 2px 0;">Order ID: #${order.id}</p>
                <p style="margin: 2px 0;">Date: ${new Date(order.createdAt).toLocaleString()}</p>
                <p style="margin: 2px 0;">Type: ${order.orderType.toUpperCase()}</p>
                ${order.customer ? `<p style="margin: 2px 0;">Customer: ${order.customer.name}</p>` : ''}
                <hr style="border: none; border-top: 1px dashed #000; margin: 5px 0;">
            </div>

            <div style="margin-bottom: 10px;">
                ${itemsHtml}
                <hr style="border: none; border-top: 1px dashed #000; margin: 5px 0;">
            </div>

            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal:</span>
                    <span>Rs.${parseFloat(order.totalAmount).toFixed(2)}</span>
                </div>
                ${parseFloat(order.tax) > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Tax:</span>
                    <span>Rs.${parseFloat(order.tax).toFixed(2)}</span>
                </div>` : ''}
                ${parseFloat(order.orderDiscount) > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Discount:</span>
                    <span>-Rs.${parseFloat(order.orderDiscount).toFixed(2)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; margin-top: 5px;">
                    <span>TOTAL:</span>
                    <span>Rs.${parseFloat(order.totalAmount).toFixed(2)}</span>
                </div>
            </div>

            <div style="margin-bottom: 10px;">
                <p style="margin: 2px 0;">Payment Method: ${payment?.paymentMethod?.toUpperCase() || 'N/A'}</p>
                <p style="margin: 2px 0;">Status: PAID</p>
                <hr style="border: none; border-top: 1px dashed #000; margin: 5px 0;">
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <p style="margin: 0;">Thank you!</p>
                <p style="margin: 0;">Please come again.</p>
            </div>
        </div>
    `;
};

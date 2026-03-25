/**
 * Service to generate receipt HTML templates.
 */
exports.generateReceiptHtml = (order, payment, branch) => {
    const pad = (str, len, char = ' ', right = false) => {
        str = String(str);
        if (str.length >= len) return str;
        const padding = char.repeat(len - str.length);
        return right ? padding + str : str + padding;
    };

    const width = 42; // Standard thermal printer width

    const itemsHtml = order.items.map(item => {
        let modificationsHtml = '';
        if (item.modifications && item.modifications.length > 0) {
            modificationsHtml = item.modifications.map(mod => {
                const modName = `- ${mod.modification?.name || 'Extra'}`;
                const modPrice = `Rs.${parseFloat(mod.price).toFixed(2)}`;
                return `<div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-left: 10px;">
                    <span>${modName}</span>
                    <span>${modPrice}</span>
                </div>`;
            }).join('');
        }

        const name = `${item.product?.name || 'Item'} ${item.variation?.name ? '(' + item.variation.name + ')' : ''}`;
        const price = parseFloat(item.unitPrice).toFixed(2);
        const qty = parseFloat(item.quantity).toFixed(2);
        const amount = (item.quantity * item.unitPrice).toFixed(2);

        // For thermal printer-friendly stripped text, we ensure spaces but use flex for HTML
        return `
            <div style="margin-bottom: 2px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="flex: 2;">${name}</span>
                    <span style="flex: 1; text-align: right;">${price}</span>
                    <span style="flex: 1; text-align: right;">${qty}</span>
                    <span style="flex: 1; text-align: right;">${amount}</span>
                </div>
                ${modificationsHtml}
            </div>
        `;
    }).join('');

    const totalDiscount = parseFloat(order.orderDiscount || 0);
    const subTotal = (parseFloat(order.totalAmount) + totalDiscount).toFixed(2);
    const totalQty = order.items.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toFixed(2);
    const date = new Date(order.createdAt);

    return `
        <div style="width: 320px; font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.2; color: #000; background: #fff; padding: 10px;">
            <div style="text-align: center; margin-bottom: 10px; font-weight: bold;">
                <div style="font-size: 1.2em; text-transform: uppercase;">${branch?.name || 'CATERING BY AHAS GAWWA'}</div>
                <div>${branch?.location || 'No. 226, Arakawila, Handapangoda'}</div>
                <div>${branch?.mobile || '0742013332 - 0112995828'}</div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; margin-bottom: 2px;">
                <span style="font-weight: bold;">${order.id.toString().padStart(8, '0')}</span>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>CASHIER: ${order.user?.name || 'Staff'}</span>
                <span>UNIT: ${branch?.id || '1'}</span>
            </div>

            <div style="display: flex; justify-content: space-between; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; font-weight: bold; text-transform: uppercase;">
                <span style="flex: 2;">PRODUCT</span>
                <span style="flex: 1; text-align: right;">PRICE</span>
                <span style="flex: 1; text-align: right;">QTY</span>
                <span style="flex: 1; text-align: right;">AMOUNT</span>
            </div>

            <div style="text-align: center; margin: 4px 0; font-weight: bold;">Original</div>

            <div style="margin-bottom: 5px;">
                ${itemsHtml}
                ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                    <span>Promotion Discount</span>
                    <span>-${totalDiscount.toFixed(2)}</span>
                </div>` : ''}
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            </div>

            <div style="margin-bottom: 10px; font-weight: bold;">
                <div style="display: flex; justify-content: space-between; font-size: 1.1em;">
                    <span>SUB TOTAL</span>
                    <span>${parseFloat(order.totalAmount).toFixed(2)}</span>
                </div>
            </div>

            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>CASH</span>
                    <span>${parseFloat(order.totalAmount).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold;">
                    <span>BALANCE</span>
                    <span>0.00</span>
                </div>
                ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span>Your savings</span>
                    <span>Rs. ${totalDiscount.toFixed(2)}</span>
                </div>` : ''}
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            </div>

            <div style="margin-bottom: 10px; font-size: 0.9em;">
                <div style="display: flex; justify-content: space-between;">
                    <span>NO OF ITEMS ${parseFloat(order.items.length).toFixed(2)}</span>
                    <span>TOTAL QTY: ${totalQty}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>DATE: ${date.toLocaleDateString('en-GB')}</span>
                    <span>TIME: ${date.toLocaleTimeString('en-GB')}</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 10px;">
                <div style="font-weight: bold; margin-bottom: 2px;">THANK YOU COME AGAIN</div>
                <div style="font-size: 0.85em;">SOFTWARE BY RETAIL IT www.retailit.lk</div>
            </div>
        </div>
    `;
};

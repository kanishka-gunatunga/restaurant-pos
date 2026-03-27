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
                // Keep flex for web, and add spaces for printer stripping
                return `<div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-left: 10px;">
                    <span>${modName}</span>
                    <span>${modPrice}</span>
                </div>`;
            }).join('');
        }

        const name = (item.product?.name || 'Item').substring(0, 18);
        const variation = item.variation?.name ? `(${item.variation.name})` : '';
        const fullName = `${name} ${variation}`.padEnd(20);
        const price = parseFloat(item.unitPrice).toFixed(2).padStart(9);
        const qty = parseFloat(item.quantity).toFixed(2).padStart(5);
        const amount = (item.quantity * item.unitPrice).toFixed(2).padStart(10);

        return `
            <div style="margin-bottom: 2px;">
                <div style="display: flex; justify-content: space-between; white-space: pre;"><span style="flex: 2;">${fullName} </span><span style="flex: 1; text-align: right;">${price} </span><span style="flex: 1; text-align: right;">${qty} </span><span style="flex: 1; text-align: right;">${amount}</span></div>
                ${modificationsHtml}
            </div>
        `;
    }).join('');

    const totalDiscount = parseFloat(order.orderDiscount || 0);
    const totalQty = order.items.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toFixed(2);
    const subTotal = (parseFloat(order.totalAmount || 0)).toFixed(2);
    const date = new Date(order.createdAt);

    return `
        <div style="width: 380px; font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.2; color: #000; background: #fff; padding: 10px; white-space: pre-wrap;">
            <div style="text-align: center; margin-bottom: 10px; font-weight: bold;">
                <div style="font-size: 1.25em; text-transform: uppercase;">${branch?.name || 'CATERING BY AHAS GAWWA'}</div>
                <div>${branch?.location || 'No. 226, Arakawila, Handapangoda'}</div>
                <div>${branch?.mobile || '0112175275'}</div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; margin-bottom: 2px; font-weight: bold;"><span>${order.id.toString().padStart(8, '0')}</span></div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; white-space: pre;"><span>CASHIER: ${order.user?.name || 'Staff'}                </span><span>UNIT: ${branch?.id || '1'}</span></div>

            <div style="display: flex; justify-content: space-between; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; font-weight: bold; text-transform: uppercase; white-space: pre;"><span style="flex: 2;">PRODUCT               </span> <span style="flex: 1; text-align: right;">PRICE  </span> <span style="flex: 1; text-align: right;">QTY   </span> <span style="flex: 1; text-align: right;">AMOUNT</span></div>

            <div style="text-align: center; margin: 4px 0; font-weight: bold;">Original</div>

            <div style="margin-bottom: 5px;">
                ${itemsHtml}
                ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 2px; white-space: pre;"><span>Promotion Discount                            </span> <span>${(-totalDiscount).toFixed(2).padStart(10)}</span></div>` : ''}
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            </div>

            <div style="margin-bottom: 10px; font-weight: bold;">
                <div style="display: flex; justify-content: space-between; font-size: 1.1em; white-space: pre;"><span>SUB TOTAL                                     </span><span>${subTotal.padStart(8)}</span></div>
            </div>

            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; white-space: pre;"><span>CASH                                          </span><span>${subTotal.padStart(8)}</span></div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; white-space: pre;"><span>BALANCE                                       </span><span>${(0).toFixed(2).padStart(8)}</span></div>
                ${totalDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 4px; white-space: pre;"><span>Your savings                    Rs.           </span><span>${totalDiscount.toFixed(2).padStart(8)}</span></div>` : ''}
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            </div>

            <div style="margin-bottom: 10px; font-size: 0.9em;">
                <div style="display: flex; justify-content: space-between; white-space: pre;"><span>NO OF ITEMS ${parseFloat(order.items.length).toFixed(2).padEnd(10)}</span><span>TOTAL QTY: ${totalQty.padStart(8)}</span></div>
                <div style="display: flex; justify-content: space-between; white-space: pre;"><span>DATE: ${date.toLocaleDateString('en-GB').padEnd(15)}</span><span>TIME: ${date.toLocaleTimeString('en-GB').padStart(18)}</span></div>
            </div>

            <div style="text-align: center; margin-top: 10px;">
                <div style="font-weight: bold; margin-bottom: 2px;">THANK YOU COME AGAIN</div>
                <div style="font-size: 0.85em;">SOFTWARE BY SLTMobitel</div>
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

        const name = (item.product?.name || 'Item').substring(0, 25);
        const variation = item.variation?.name ? `(${item.variation.name})` : '';
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
        <div style="width: 380px; font-family: 'Courier New', Courier, monospace; line-height: 1.2; color: #000; background: #fff; padding: 10px;">
            <div style="text-align: center; border: 2px solid #000; padding: 5px; margin-bottom: 10px;">
                <div style="font-size: 1.8em; font-weight: bold; text-transform: uppercase;">KITCHEN COPY</div>
                <div style="font-size: 1.2em;">Order #${order.id.toString().padStart(8, '0')}</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; font-size: 1.1em;">
                <span>TYPE: ${order.orderType || 'N/A'}</span>
                <span>TABLE: ${order.tableNumber || 'N/A'}</span>
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
                <div>TIME: ${date.toLocaleString('en-GB')}</div>
            </div>
        </div>
    `;
};

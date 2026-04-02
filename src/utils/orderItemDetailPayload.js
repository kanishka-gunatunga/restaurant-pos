const { Op } = require('sequelize');
const Variation = require('../models/Variation');
const VariationOption = require('../models/VariationOption');
const ModificationItem = require('../models/ModificationItem');
const Modification = require('../models/Modification');

function modificationRowNeedsResolve(row) {
    if (row == null || row.modificationId == null) {
        return false;
    }
    const nested = row.modification;
    if (!nested || typeof nested !== 'object') {
        return true;
    }
    const label = nested.title ?? nested.name ?? nested.label;
    return !label;
}

async function enrichItemModifications(items) {
    if (!items?.length) {
        return;
    }

    const ids = new Set();
    for (const item of items) {
        const rows = item.modifications;
        if (!Array.isArray(rows)) {
            continue;
        }
        for (const row of rows) {
            if (row && modificationRowNeedsResolve(row)) {
                ids.add(row.modificationId);
            }
        }
    }

    let itemById = new Map();
    let groupById = new Map();
    if (ids.size > 0) {
        const idList = [...ids];
        const modItems = await ModificationItem.findAll({
            where: { id: { [Op.in]: idList } },
            attributes: ['id', 'title', 'price', 'modificationId'],
        });
        itemById = new Map(modItems.map((m) => [m.id, m.toJSON()]));
        const missing = idList.filter((id) => !itemById.has(id));
        if (missing.length > 0) {
            const groups = await Modification.findAll({
                where: { id: { [Op.in]: missing } },
                attributes: ['id', 'title'],
            });
            groupById = new Map(groups.map((g) => [g.id, g.toJSON()]));
        }
    }

    for (const item of items) {
        const rows = Array.isArray(item.modifications) ? item.modifications : [];
        item.modifications = rows;

        for (const row of rows) {
            const q = row.quantity ?? row.qty;
            const qty = q != null && q !== '' ? Math.max(1, parseInt(q, 10) || 1) : 1;
            row.quantity = qty;
            row.qty = qty;
            row.modification_id = row.modificationId;

            if (!modificationRowNeedsResolve(row)) {
                const nested = row.modification;
                if (nested.title == null && nested.name != null) {
                    nested.title = nested.name;
                }
                continue;
            }

            const mid = row.modificationId;
            const mi = itemById.get(mid);
            if (mi) {
                row.modification = {
                    id: mi.id,
                    title: mi.title,
                    price: mi.price != null ? mi.price : row.price,
                    modificationId: mi.modificationId,
                };
            } else {
                const g = groupById.get(mid);
                if (g) {
                    row.modification = {
                        id: g.id,
                        title: g.title,
                        price: row.price,
                        modificationId: null,
                    };
                }
            }
        }

        item.order_modifications = rows;
        item.orderModifications = rows;
    }
}

async function enrichOrderJsonItemsForDetail(orderJson) {
    if (!orderJson?.items?.length) {
        return orderJson;
    }

    const idsToCheck = new Set();
    for (const item of orderJson.items) {
        const hasExplicit =
            item.variationOption &&
            (item.variationOption.id != null || item.variationOption.name != null);
        if (!hasExplicit && item.variationOptionId != null) {
            idsToCheck.add(item.variationOptionId);
        }
    }

    let optionById = new Map();
    let variationById = new Map();
    if (idsToCheck.size > 0) {
        const options = await VariationOption.findAll({
            where: { id: [...idsToCheck] },
            attributes: ['id', 'name', 'variationId'],
        });
        optionById = new Map(options.map((o) => [o.id, o]));
        const parentIds = [...new Set(options.map((o) => o.variationId))];
        if (parentIds.length > 0) {
            const vars = await Variation.findAll({ where: { id: parentIds } });
            variationById = new Map(vars.map((v) => [v.id, v.toJSON()]));
        }
    }

    for (const item of orderJson.items) {
        const hasExplicit =
            item.variationOption &&
            (item.variationOption.id != null || item.variationOption.name != null);

        if (!hasExplicit && item.variationOptionId != null) {
            const opt = optionById.get(item.variationOptionId);
            if (opt) {
                const optJson = opt.toJSON();
                item.variationOption = optJson;
                const parent = variationById.get(opt.variationId);
                if (parent) {
                    item.variationOption.Variation = parent;
                }
            }
        }

        if (item.variationOption && (item.variationOption.id != null || item.variationOption.name)) {
            item.variation_option = item.variationOption;
        } else {
            item.variation_option = null;
        }
    }

    await enrichItemModifications(orderJson.items);

    return orderJson;
}

module.exports = { enrichOrderJsonItemsForDetail };

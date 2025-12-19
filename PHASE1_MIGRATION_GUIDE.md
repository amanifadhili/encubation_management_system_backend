# Phase 1 Migration Guide

## Status: Schema Complete ✅

All Phase 1 database schema changes have been implemented in `prisma/schema.prisma`.

## Migration Options

### Option 1: Using `prisma db push` (Recommended for Development)

This command updates your database schema without creating migration files. It's faster and doesn't require shadow database permissions.

```bash
cd encubation_management_system_backend
npx prisma db push
```

**Note**: This will apply schema changes directly. Make sure you have a backup if needed.

### Option 2: Creating Migration Files (Requires Shadow Database)

If you have permission to create shadow databases, you can use:

```bash
cd encubation_management_system_backend
npx prisma migrate dev --name phase1_inventory_enhancements
```

**If you get shadow database errors**, you can:

1. **Configure shadow database URL** in your `.env` file:
   ```
   SHADOW_DATABASE_URL="mysql://user:password@host:port/shadow_db"
   ```

2. **Or use `--skip-seed` and manually handle migrations**

### Option 3: Manual Migration (For Production)

1. Review the schema changes in `prisma/schema.prisma`
2. Generate SQL using:
   ```bash
   npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
   ```
3. Apply the SQL manually to your database

## Schema Changes Summary

### New Enums
- `ItemCategory` - Equipment, Tools, Furniture, Electronics, Consumables, Refreshments, OfficeSupplies, Software, Vehicles, Other
- `ItemType` - Perishable, NonPerishable, Returnable, Consumable, Refreshment, FixedAsset
- `ItemCondition` - New, Good, Fair, Poor, Damaged, Retired
- Extended `InventoryStatus` - Added: reserved, assigned, maintenance, damaged, retired, disposed

### New Models
1. **StorageLocation** - For location management with hierarchy
2. **Supplier** - For supplier/vendor information
3. **ConsumptionLog** - For tracking refreshments distribution
4. **InventoryTransaction** - For audit trail
5. **InventoryReservation** - For booking system
6. **MaintenanceLog** - For maintenance tracking

### Enhanced Models
1. **InventoryItem** - Added many new fields:
   - Category, item_type, tags, custom_fields
   - SKU, barcode, serial_number
   - Condition, location_id
   - Consumables tracking fields (consumed_quantity, min_stock_level, reorder_quantity, etc.)
   - Warranty and maintenance fields
   - Supplier relation

2. **InventoryAssignment** - Enhanced with:
   - assigned_by (User relation)
   - expected_return, returned_at
   - return_condition, return_notes
   - status field

### Important Notes

⚠️ **Default Values**: New required fields have defaults to ensure backward compatibility:
- `category` defaults to `Other`
- `item_type` defaults to `Consumable`
- `condition` defaults to `Good`
- `status` in assignments defaults to `"active"`

⚠️ **Existing Data**: Existing inventory items will be updated with default values when migration is applied.

## After Migration

1. Regenerate Prisma Client:
   ```bash
   npx prisma generate
   ```

2. Update TypeScript types in your codebase

3. Update controllers and services to handle new fields

## Next Steps

After successful migration:
1. ✅ Schema validation complete
2. ⏳ Update backend controllers
3. ⏳ Update API routes
4. ⏳ Update frontend components
5. ⏳ Add seed data for testing

-- Seed production groups for Damascus Hotel
-- Based on actual menu items in the database

-- Clear existing groups (fresh seed)
TRUNCATE production_group_items, production_groups RESTART IDENTITY CASCADE;

-- Insert groups
INSERT INTO production_groups (name, unit) VALUES
  ('Tea',        'cups'),
  ('Coffee',     'cups'),
  ('Juice',      'glasses'),
  ('Soda',       'bottles'),
  ('Ugali',      'portions'),
  ('Rice',       'portions'),
  ('Pilau',      'portions'),
  ('Beans & Githeri', 'portions'),
  ('Managu',     'portions'),
  ('Minji',      'portions'),
  ('Chicken',    'portions'),
  ('Beef',       'portions'),
  ('Fish',       'portions'),
  ('Sausage',    'pieces'),
  ('Chapati',    'pieces'),
  ('Ndazi',      'pieces'),
  ('Chips',      'portions'),
  ('Kebab',      'pieces'),
  ('Samosa',     'pieces'),
  ('Eggs',       'pieces');

-- TEA group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-TEA-103',    1),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-TEA-0018',   1),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-TEA-2415',   1),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-TEABLA-105', 1),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-TEAMIL-104', 1),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-GINGER-367', 1),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-TEAMAS-430', 1),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-FLUSK5-383', 5),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-FLUSK10-384',10),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'MI-FLUSK2-402', 10),
  ((SELECT id FROM production_groups WHERE name='Tea'), 'M01',           1);

-- COFFEE group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Coffee'), 'MI-BLACKC-409', 1),
  ((SELECT id FROM production_groups WHERE name='Coffee'), 'MI-WHITEC-429', 1),
  ((SELECT id FROM production_groups WHERE name='Coffee'), 'MI-WHITCP-432', 1),
  ((SELECT id FROM production_groups WHERE name='Coffee'), 'MI-LEMONC-254', 1);

-- JUICE group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Juice'), 'MI-MANGOJ-027', 1),
  ((SELECT id FROM production_groups WHERE name='Juice'), 'MI-MANGOW-028', 2),
  ((SELECT id FROM production_groups WHERE name='Juice'), 'MI-PASSIO-029', 1),
  ((SELECT id FROM production_groups WHERE name='Juice'), 'MI-PASSIJ-030', 2),
  ((SELECT id FROM production_groups WHERE name='Juice'), 'MI-AVOCAD-031', 1),
  ((SELECT id FROM production_groups WHERE name='Juice'), 'MI-AVOCAJ-032', 2),
  ((SELECT id FROM production_groups WHERE name='Juice'), 'MI-PINEAP-428', 1),
  ((SELECT id FROM production_groups WHERE name='Juice'), 'M09',           1);

-- SODA group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Soda'), 'MI-SODA3-017', 1),
  ((SELECT id FROM production_groups WHERE name='Soda'), 'MI-SODA5-018', 1);

-- UGALI group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Ugali'), 'MI-UGALIP-399', 1),
  ((SELECT id FROM production_groups WHERE name='Ugali'), 'MI-UGALIW-310', 1),
  ((SELECT id FROM production_groups WHERE name='Ugali'), 'MI-UGALIB-012', 1),
  ((SELECT id FROM production_groups WHERE name='Ugali'), 'MI-UGALIC-013', 1),
  ((SELECT id FROM production_groups WHERE name='Ugali'), 'MI-MANAGU-308', 1),
  ((SELECT id FROM production_groups WHERE name='Ugali'), 'MI-MANAGU2-289',1),
  ((SELECT id FROM production_groups WHERE name='Ugali'), 'MI-LIVERF-136', 1);

-- RICE group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Rice'), 'MI-RICEP-400', 1),
  ((SELECT id FROM production_groups WHERE name='Rice'), 'MI-RICES-150', 1),
  ((SELECT id FROM production_groups WHERE name='Rice'), 'MI-RICEBE-190',1);

-- PILAU group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Pilau'), 'MI-PILAUS-009', 1),
  ((SELECT id FROM production_groups WHERE name='Pilau'), 'MI-PILAUP-148', 1),
  ((SELECT id FROM production_groups WHERE name='Pilau'), 'MI-PILAUF-033', 1);

-- BEANS & GITHERI group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Beans & Githeri'), 'MI-BEANS-191',   1),
  ((SELECT id FROM production_groups WHERE name='Beans & Githeri'), 'MI-GITHERP-132', 1),
  ((SELECT id FROM production_groups WHERE name='Beans & Githeri'), 'MI-GITHES-133',  1),
  ((SELECT id FROM production_groups WHERE name='Beans & Githeri'), 'MI-MINJIC-142',  1);

-- MANAGU group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Managu'), 'MI-MANAGU-308',  1),
  ((SELECT id FROM production_groups WHERE name='Managu'), 'MI-MANAGU2-289', 1),
  ((SELECT id FROM production_groups WHERE name='Managu'), 'MI-DAMASL-139',  1);

-- MINJI group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Minji'), 'MI-MINJIC-142', 1);

-- CHICKEN group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-14CHIC-115',  1),
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-14CHICW-118', 1),
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-14CHICB-422', 1),
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-CHICK2-116',  2),
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-CHICK3-117',  4),
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-UGALIC-013',  1),
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-CHICKG-120',  1),
  ((SELECT id FROM production_groups WHERE name='Chicken'), 'MI-CHICKI-121',  1);

-- BEEF group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Beef'), 'MI-UGALIB-012', 1),
  ((SELECT id FROM production_groups WHERE name='Beef'), 'MI-BEEFB-119',  1);

-- FISH group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Fish'), 'MI-FISHF-424', 1),
  ((SELECT id FROM production_groups WHERE name='Fish'), 'MI-FISHB-423', 1);

-- SAUSAGE group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Sausage'), 'MI-SAUSAG-076', 1),
  ((SELECT id FROM production_groups WHERE name='Sausage'), 'MI-SAUSAS-077', 1);

-- CHAPATI group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Chapati'), 'MI-CHAPAT-056', 1),
  ((SELECT id FROM production_groups WHERE name='Chapati'), 'MI-CHAPEX-419', 1),
  ((SELECT id FROM production_groups WHERE name='Chapati'), 'MI-MINJIC-142', 1),
  ((SELECT id FROM production_groups WHERE name='Chapati'), 'MI-KWOTAK-135', 1);

-- NDAZI group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Ndazi'), 'MI-NDAZI-070', 1);

-- CHIPS group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Chips'), 'MI-CHIPSP-060', 1),
  ((SELECT id FROM production_groups WHERE name='Chips'), 'MI-CHIPSM-059', 1);

-- KEBAB group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Kebab'), 'MI-KEBAB-067',  1),
  ((SELECT id FROM production_groups WHERE name='Kebab'), 'MI-KEBABE-431', 1);

-- SAMOSA group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Samosa'), 'MI-SAMOSA-074', 1),
  ((SELECT id FROM production_groups WHERE name='Samosa'), 'MI-SAMOS2-075', 1);

-- EGGS group
INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES
  ((SELECT id FROM production_groups WHERE name='Eggs'), 'MI-BOILEE-425',  1),
  ((SELECT id FROM production_groups WHERE name='Eggs'), 'MI-BOILEE2-194', 1),
  ((SELECT id FROM production_groups WHERE name='Eggs'), 'MI-SCRAMB-295',  1);

SELECT g.name, count(gi.id) as items FROM production_groups g
LEFT JOIN production_group_items gi ON gi.group_id = g.id
GROUP BY g.name ORDER BY g.name;

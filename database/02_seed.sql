-- Synthetic sample records; run against a fresh opsflow schema.
USE opsflow;
INSERT INTO products (id,sku,name,category,price,stock_qty,reorder_level) VALUES
(1,'TEC-KEY-001','Wireless Mechanical Keyboard','Accessories',89.00,48,12),
(2,'HOM-LMP-002','Ambient Desk Lamp','Workspace',49.00,8,12),
(3,'TEC-MOU-003','Ergonomic Wireless Mouse','Accessories',39.00,75,15),
(4,'TEC-HUB-004','7-in-1 USB-C Hub','Electronics',65.00,12,10),
(5,'AUD-HED-005','Studio Wireless Headphones','Audio',149.00,6,8),
(6,'HOM-STD-006','Aluminum Laptop Stand','Workspace',59.00,40,12),
(7,'HOM-NOT-007','Minimalist Notebook Set','Stationery',24.00,130,25),
(8,'TEC-CAM-008','Full HD Smart Webcam','Electronics',119.00,19,10),
(9,'HOM-MAT-009','Desk Pad XL','Workspace',29.00,64,15),
(10,'TEC-SSD-010','Portable SSD 1TB','Electronics',179.00,7,10),
(11,'HOM-ARM-011','Adjustable Monitor Arm','Workspace',139.00,11,8),
(12,'TEC-DCK-012','Universal Charging Dock','Electronics',99.00,26,10);

INSERT INTO orders (id, order_code, customer_name, customer_email, status, total_amount, created_at) VALUES
(1,'OF-SAMPLE-1001','Olivia Bennett','olivia@example.test','delivered',178.00,NOW() - INTERVAL 6 DAY),
(2,'OF-SAMPLE-1002','Noah Williams','noah@example.test','shipped',208.00,NOW() - INTERVAL 5 DAY),
(3,'OF-SAMPLE-1003','Sophia Chen','sophia@example.test','processing',149.00,NOW() - INTERVAL 4 DAY),
(4,'OF-SAMPLE-1004','Liam Carter','liam@example.test','pending',65.00,NOW() - INTERVAL 3 DAY),
(5,'OF-SAMPLE-1005','Ava Martinez','ava@example.test','shipped',102.00,NOW() - INTERVAL 2 DAY),
(6,'OF-SAMPLE-1006','Ethan Brooks','ethan@example.test','delivered',119.00,NOW() - INTERVAL 2 DAY),
(7,'OF-SAMPLE-1007','Mia Taylor','mia@example.test','processing',179.00,NOW() - INTERVAL 1 DAY),
(8,'OF-SAMPLE-1008','Lucas Davis','lucas@example.test','pending',99.00,NOW());
INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price) VALUES
(1,1,'Wireless Mechanical Keyboard',2,89.00),
(2,5,'Studio Wireless Headphones',1,149.00), (2,6,'Aluminum Laptop Stand',1,59.00),
(3,5,'Studio Wireless Headphones',1,149.00),
(4,4,'7-in-1 USB-C Hub',1,65.00),
(5,2,'Ambient Desk Lamp',1,49.00), (5,7,'Minimalist Notebook Set',1,24.00), (5,9,'Desk Pad XL',1,29.00),
(6,8,'Full HD Smart Webcam',1,119.00),
(7,10,'Portable SSD 1TB',1,179.00),
(8,12,'Universal Charging Dock',1,99.00);
INSERT INTO order_events (order_id,status,note,created_at) VALUES
(1,'delivered','Delivered successfully',NOW() - INTERVAL 1 DAY),
(2,'shipped','Carrier handoff complete',NOW() - INTERVAL 1 DAY),
(3,'processing','Order packed for fulfillment',NOW() - INTERVAL 1 DAY),
(4,'pending','Order created',NOW() - INTERVAL 3 DAY),
(5,'shipped','Handed over to shipping',NOW() - INTERVAL 1 DAY),
(6,'delivered','Delivered successfully',NOW() - INTERVAL 1 DAY),
(7,'processing','Preparing items',NOW() - INTERVAL 1 DAY),
(8,'pending','Order created',NOW());

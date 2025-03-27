-- MySQL dump 10.13  Distrib 9.2.0, for macos14.7 (arm64)
--
-- Host: localhost    Database: my_dojang_db
-- ------------------------------------------------------
-- Server version	9.0.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `absences`
--

DROP TABLE IF EXISTS `absences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `absences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `class_id` int NOT NULL,
  `dojang_code` varchar(255) NOT NULL,
  `absence_date` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_absence` (`student_id`,`class_id`,`absence_date`),
  KEY `absences_ibfk_2` (`class_id`),
  CONSTRAINT `absences_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `absences_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `class_details` (`class_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=320 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `absences`
--

LOCK TABLES `absences` WRITE;
/*!40000 ALTER TABLE `absences` DISABLE KEYS */;
INSERT INTO `absences` VALUES (312,102,2691,'UM2024','2025-03-17'),(313,112,2691,'UM2024','2025-03-17'),(314,70,2685,'UM2024','2025-03-20'),(315,102,2685,'UM2024','2025-03-20'),(316,112,2685,'UM2024','2025-03-20'),(317,70,2691,'UM2024','2025-03-24'),(318,102,2691,'UM2024','2025-03-24'),(319,112,2691,'UM2024','2025-03-24');
/*!40000 ALTER TABLE `absences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `class_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `belt_rank` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance` (`student_id`,`class_id`,`attendance_date`),
  KEY `attendance_ibfk_2` (`class_id`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=179 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (178,70,2691,'2025-03-17','UM2024',2);
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `badges`
--

DROP TABLE IF EXISTS `badges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `badges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `dojang_code` varchar(255) NOT NULL,
  `test_template_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `condition_value` int NOT NULL COMMENT '배지를 획득하기 위한 최소 조건 값',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `badges`
--

LOCK TABLES `badges` WRITE;
/*!40000 ALTER TABLE `badges` DISABLE KEYS */;
INSERT INTO `badges` VALUES (22,'Speed kick 60','https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/DALLÂ·E 2024-09-24 12.27.47 - Create a single-line set of badges resembling embroidered chevron shapes in a V shape, with the following colors_ white, yellow, orange, green, blue,  (1).jpeg','UM2024',6,'2025-03-10 03:35:55','2025-03-10 03:35:55',60),(23,'Speed kick 70','https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/DALLÂ·E 2024-09-24 12.27.47 - Create a single-line set of badges resembling embroidered chevron shapes in a V shape, with the following colors_ white, yellow, orange, green, blue,  (2).jpeg','UM2024',6,'2025-03-10 03:36:18','2025-03-10 03:36:18',70),(24,'Push up 60','https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/DALLÂ·E 2024-09-24 12.27.47 - Create a single-line set of badges resembling embroidered chevron shapes in a V shape, with the following colors_ white, yellow, orange, green, blue, .jpeg','UM2024',7,'2025-03-10 03:38:19','2025-03-10 03:38:19',60);
/*!40000 ALTER TABLE `badges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `belt_sizes`
--

DROP TABLE IF EXISTS `belt_sizes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `belt_sizes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `belt_id` int NOT NULL,
  `dojang_code` varchar(255) NOT NULL DEFAULT 'default_code',
  `size` varchar(10) NOT NULL,
  `quantity` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `belt_id` (`belt_id`),
  CONSTRAINT `belt_sizes_ibfk_1` FOREIGN KEY (`belt_id`) REFERENCES `beltsystem` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `belt_sizes`
--

LOCK TABLES `belt_sizes` WRITE;
/*!40000 ALTER TABLE `belt_sizes` DISABLE KEYS */;
INSERT INTO `belt_sizes` VALUES (37,79,'UM2024','2',10),(38,79,'UM2024','4',10),(47,84,'default_code','2',11),(50,86,'default_code','2',11),(52,88,'UM2024','2',11),(54,89,'default_code','2',11),(55,90,'UM2024','2',11),(57,91,'default_code','2',11),(59,81,'default_code','2',10),(60,81,'default_code','4',10),(61,83,'default_code','2',11),(62,83,'default_code','4',11),(63,85,'default_code','2',11),(64,85,'default_code','4',11),(65,80,'UM2024','2',10),(66,80,'UM2024','4',9),(73,82,'UM2024','2',11),(74,82,'UM2024','4',10),(88,84,'UM2024','4',12),(89,86,'UM2024','4',10),(90,93,'DJ1742123011686','2',1),(93,93,'DJ1742123011686','3',1),(100,99,'DJ1742123011686','3',11),(101,100,'DJ1742123011686','S',1),(102,97,'DJ1742123011686','3',11),(103,98,'DJ1742123011686','3',18),(104,101,'DJ1742123011686','7',1),(105,101,'DJ1742123011686','8',1),(106,102,'DJ1742123011686','3',1),(107,102,'DJ1742123011686','4',1),(110,103,'UM2024','2',10),(111,103,'UM2024','4',10),(112,82,'UM2024','7',1);
/*!40000 ALTER TABLE `belt_sizes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `beltsystem`
--

DROP TABLE IF EXISTS `beltsystem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `beltsystem` (
  `id` int NOT NULL AUTO_INCREMENT,
  `belt_color` varchar(50) NOT NULL,
  `stripe_color` varchar(50) DEFAULT NULL,
  `belt_rank` int NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_belt` (`belt_color`,`stripe_color`,`dojang_code`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `beltsystem`
--

LOCK TABLES `beltsystem` WRITE;
/*!40000 ALTER TABLE `beltsystem` DISABLE KEYS */;
INSERT INTO `beltsystem` VALUES (40,'White','No Stripe',1,'DJ1730305859821'),(41,'Yellow ','No Stripe',2,'DJ1730305859821'),(42,'Orange','No Stripe',3,'DJ1730305859821'),(43,'Green','No Stripe',4,'DJ1730305859821'),(44,'High Green','Black Stripe',5,'DJ1730305859821'),(45,'Purple','No Stripe',6,'DJ1730305859821'),(46,'High Purple','Black Stripe',7,'DJ1730305859821'),(47,'Blue','No Stripe',8,'DJ1730305859821'),(48,'High Blue','Black Stripe',9,'DJ1730305859821'),(49,'Brown','No Stripe',10,'DJ1730305859821'),(50,'High Brown','Black Stripe',11,'DJ1730305859821'),(51,'Red','No Stripe',12,'DJ1730305859821'),(52,'High Red','Black Stripe',13,'DJ1730305859821'),(53,'Black 1st','No Stripe',14,'DJ1730305859821'),(79,'White','No Stripe',1,'UM2024'),(80,'Yellow','No Stripe',2,'UM2024'),(81,'Orange','No Stripe',3,'UM2024'),(82,'Green','No Stripe',4,'UM2024'),(83,'Purple','No Stripe',5,'UM2024'),(84,'High purple','Black Stripe',6,'UM2024'),(85,'Blue','No Stripe',7,'UM2024'),(86,'High Blue','Black Stripe',8,'UM2024'),(88,'Brown','No Stripe',9,'UM2024'),(89,'High Brown','Black Stripe',10,'UM2024'),(90,'Red','No Stripe',11,'UM2024'),(91,'High Red','Black Stripe',12,'UM2024'),(93,'White hih',NULL,1,'DJ1742123011686'),(97,'Yellow',NULL,3,'DJ1742123011686'),(98,'White high','Black Stripe',4,'DJ1742123011686'),(99,'Orange',NULL,5,'DJ1742123011686'),(100,'Green','Black Stripe',6,'DJ1742123011686'),(101,'Black','Yellow Stripe',7,'DJ1742123011686'),(102,'White',NULL,8,'DJ1742123011686'),(103,'Black','No Stripe',13,'UM2024');
/*!40000 ALTER TABLE `beltsystem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (11,'Unifrom & T-shirts','2024-10-22 16:40:29','UM2024'),(12,'Sparring gear','2024-10-22 16:40:41','UM2024'),(24,'Uniform & T-shirt','2024-11-03 00:12:35','DJ1730305859821'),(25,'Sparring gears','2024-11-03 00:13:28','DJ1730305859821'),(37,'Uniform 🥋','2025-03-17 16:40:22','DJ1742123011686'),(39,'T-shirt 👕','2025-03-17 17:37:04','DJ1742123011686'),(44,'Weapon','2025-03-23 01:52:50','UM2024');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `class_details`
--

DROP TABLE IF EXISTS `class_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `class_details` (
  `class_id` int NOT NULL AUTO_INCREMENT,
  `day` varchar(10) DEFAULT NULL,
  `time` varchar(20) DEFAULT NULL,
  `classname` varchar(50) DEFAULT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`class_id`),
  UNIQUE KEY `unique_class` (`day`,`time`,`classname`,`dojang_code`)
) ENGINE=InnoDB AUTO_INCREMENT=2692 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `class_details`
--

LOCK TABLES `class_details` WRITE;
/*!40000 ALTER TABLE `class_details` DISABLE KEYS */;
INSERT INTO `class_details` VALUES (2672,'Mon','3:00~4:00','Level 1','DJ1742123011686','regular'),(2673,'Tue','3:00~4:00','Level 2','DJ1742123011686','regular'),(2674,'Wed','3:00~4:00','Level 3','DJ1742123011686','regular'),(2675,'Thur','3:00~4:00','Test1','DJ1742123011686','test'),(2676,'Fri','3:00~4:00','Belt test','DJ1742123011686','test'),(2677,'Sat','3:00~4:00','Promotion belt','DJ1742123011686','test'),(2684,'Wed','3:20~3:50','Level 3','UM2024','regular'),(2685,'Thur','3:20~3:50','Level 1','UM2024','regular'),(2689,'Tue','4:00~5:00','Promotion','UM2024','test'),(2690,'Fri','4:00~5:00','Test','UM2024','test'),(2691,'Mon','3:20~3:50','Level 1','UM2024','regular');
/*!40000 ALTER TABLE `class_details` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `set_test_type_on_insert` BEFORE INSERT ON `class_details` FOR EACH ROW BEGIN
  IF LOWER(NEW.classname) LIKE '%test%'
     OR LOWER(NEW.classname) LIKE '%promotion%'
     OR LOWER(NEW.classname) LIKE '%exam%' THEN
    SET NEW.type = 'test';
  ELSE
    SET NEW.type = 'regular';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `classconditions`
--

DROP TABLE IF EXISTS `classconditions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classconditions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_name` varchar(255) NOT NULL,
  `belt_min_rank` int DEFAULT NULL,
  `belt_max_rank` int DEFAULT NULL,
  `age_min` int DEFAULT NULL,
  `age_max` int DEFAULT NULL,
  `class_max_capacity` int DEFAULT '0',
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_class_name` (`class_name`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `classconditions`
--

LOCK TABLES `classconditions` WRITE;
/*!40000 ALTER TABLE `classconditions` DISABLE KEYS */;
INSERT INTO `classconditions` VALUES (27,'Level1',1,3,6,50,33,'DJ1730305859821'),(28,'Level2',4,9,6,50,33,'DJ1730305859821'),(31,'Level3',10,14,6,50,33,'DJ1730305859821'),(36,'Level 1',1,3,6,19,30,'UM2024'),(37,'Level 2',4,8,6,19,30,'UM2024'),(38,'Level 3',9,13,6,19,30,'UM2024'),(39,'Pre K',1,3,4,6,30,'UM2024'),(40,'Teen',1,13,13,19,30,'UM2024'),(41,'Adult',1,13,20,70,30,'UM2024');
/*!40000 ALTER TABLE `classconditions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dojangs`
--

DROP TABLE IF EXISTS `dojangs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dojangs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojang_code` varchar(50) NOT NULL,
  `dojang_name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dojang_code` (`dojang_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dojangs`
--

LOCK TABLES `dojangs` WRITE;
/*!40000 ALTER TABLE `dojangs` DISABLE KEYS */;
INSERT INTO `dojangs` VALUES (1,'UM2024','JC World TKD in Smyrna'),(2,'DJ1730305859821','JC'),(3,'DJ1742123011686','Mat'),(4,'DJ1742646427653','Smyrna');
/*!40000 ALTER TABLE `dojangs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `holiday_schedule`
--

DROP TABLE IF EXISTS `holiday_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holiday_schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_date_dojang` (`date`,`dojang_code`)
) ENGINE=InnoDB AUTO_INCREMENT=186 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `holiday_schedule`
--

LOCK TABLES `holiday_schedule` WRITE;
/*!40000 ALTER TABLE `holiday_schedule` DISABLE KEYS */;
INSERT INTO `holiday_schedule` VALUES (92,'2024-10-04','DJ1730305859821'),(93,'2024-10-05','DJ1730305859821'),(74,'2024-10-08','DJ1730305859821'),(75,'2024-10-09','DJ1730305859821'),(76,'2024-10-10','DJ1730305859821'),(77,'2024-10-11','DJ1730305859821'),(78,'2024-10-12','DJ1730305859821'),(79,'2024-10-29','DJ1730305859821'),(80,'2024-10-30','DJ1730305859821'),(91,'2024-10-31','DJ1730305859821'),(96,'2024-11-01','DJ1730305859821'),(94,'2024-11-02','DJ1730305859821'),(69,'2024-11-05','DJ1730305859821'),(70,'2024-11-06','DJ1730305859821'),(71,'2024-11-07','DJ1730305859821'),(72,'2024-11-08','DJ1730305859821'),(73,'2024-11-09','DJ1730305859821'),(109,'2024-11-12','DJ1730305859821'),(110,'2024-11-13','DJ1730305859821'),(149,'2024-11-14','DJ1730305859821'),(95,'2024-11-29','DJ1730305859821'),(180,'2025-03-18','DJ1742123011686');
/*!40000 ALTER TABLE `holiday_schedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_payments`
--

DROP TABLE IF EXISTS `item_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `item_id` int NOT NULL,
  `size` varchar(50) DEFAULT NULL,
  `quantity` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `idempotency_key` varchar(255) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `currency` varchar(10) DEFAULT 'USD',
  `payment_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','completed','failed') NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `card_id` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_payments`
--

LOCK TABLES `item_payments` WRITE;
/*!40000 ALTER TABLE `item_payments` DISABLE KEYS */;
INSERT INTO `item_payments` VALUES (1,30,36,NULL,1,60.00,NULL,NULL,'USD','2024-11-08 19:03:46','completed',NULL,3,'cnon:CA4SEL92g-5ouynUABD5t1vM5PwYASgC'),(2,31,36,NULL,2,120.00,NULL,NULL,'USD','2024-11-08 19:13:52','completed',NULL,3,'cnon:CA4SEBy5hzaNQA8KqsH24E4m_i4YASgC'),(3,34,37,NULL,1,200.00,NULL,NULL,'USD','2024-11-08 19:16:27','completed',NULL,3,'cnon:CA4SEARuhzVD1YK8tz47WKcaO2kYASgC'),(4,30,36,NULL,2,120.00,NULL,NULL,'USD','2024-11-10 22:54:54','completed','DJ1730305859821',3,'cnon:CA4SEGrNpI6S3gOZjpFjQYd9PUcYASgC'),(5,32,37,NULL,2,400.00,NULL,NULL,'USD','2024-11-11 00:11:28','completed','DJ1730305859821',3,'cnon:CA4SEEddUfYcsXseij_tkVmi87EYASgC'),(6,42,37,NULL,2,40000.00,NULL,NULL,'USD','2024-11-11 00:12:04','completed','DJ1730305859821',3,'cnon:CA4SEBoyxcCoL5layzf8naKTVL0YASgC'),(7,30,36,NULL,1,7000.00,NULL,NULL,'USD','2023-07-11 13:20:00','completed','DJ1730305859821',3,'cnon:CA4SEMNBVSBYQ5RE58RATYJU8PYASgC'),(8,31,37,NULL,2,13000.00,NULL,NULL,'USD','2023-08-12 17:30:00','completed','DJ1730305859821',3,'cnon:CA4SENYGHU1P8NH69AJB8JNHKNYASgC'),(9,34,36,NULL,3,20000.00,NULL,NULL,'USD','2023-09-13 21:50:00','completed','DJ1730305859821',3,'cnon:CA4SEMRYJD8K0NH6RZMKFNTFM8YASgC'),(10,42,37,NULL,4,16000.00,NULL,NULL,'USD','2023-10-14 12:05:00','completed','DJ1730305859821',3,'cnon:CA4SELK7D8BD7YU89AOTNL6PM1YASgC'),(26,1,101,'M',1,50.00,'fa2eeff0-f1a4-11ef-b32d-7208cff9724e','credit_card','USD','2025-01-05 15:00:00','completed','UM2024',1,'fa2ef14e-f1a4-11ef-b32d-7208cff9724e'),(27,2,102,'L',2,80.00,'fa2f2074-f1a4-11ef-b32d-7208cff9724e','debit_card','USD','2025-02-10 19:30:00','completed','UM2024',2,'fa2f20b0-f1a4-11ef-b32d-7208cff9724e'),(28,3,103,'S',3,90.00,'fa2f2182-f1a4-11ef-b32d-7208cff9724e','paypal','USD','2025-03-20 13:45:00','completed','UM2024',1,'fa2f2196-f1a4-11ef-b32d-7208cff9724e'),(29,4,104,'XL',1,100.00,'fa2f2380-f1a4-11ef-b32d-7208cff9724e','credit_card','USD','2025-04-15 20:15:00','completed','UM2024',3,'fa2f239e-f1a4-11ef-b32d-7208cff9724e'),(30,5,105,'M',2,120.00,'fa2f2434-f1a4-11ef-b32d-7208cff9724e','apple_pay','USD','2025-05-25 16:30:00','completed','UM2024',2,'fa2f2452-f1a4-11ef-b32d-7208cff9724e'),(31,1,106,'M',1,55.00,'33f11fb0-f1a5-11ef-b32d-7208cff9724e','credit_card','USD','2025-06-05 14:00:00','completed','UM2024',1,'33f12348-f1a5-11ef-b32d-7208cff9724e'),(32,2,107,'L',2,85.00,'33f1534a-f1a5-11ef-b32d-7208cff9724e','debit_card','USD','2025-07-10 18:30:00','completed','UM2024',2,'33f15386-f1a5-11ef-b32d-7208cff9724e'),(33,3,108,'S',3,95.00,'33f1544e-f1a5-11ef-b32d-7208cff9724e','paypal','USD','2025-08-20 13:45:00','completed','UM2024',1,'33f1546c-f1a5-11ef-b32d-7208cff9724e'),(34,4,109,'XL',1,110.00,'33f1561a-f1a5-11ef-b32d-7208cff9724e','credit_card','USD','2025-09-15 20:15:00','completed','UM2024',3,'33f15638-f1a5-11ef-b32d-7208cff9724e'),(35,5,110,'M',2,130.00,'33f156ce-f1a5-11ef-b32d-7208cff9724e','apple_pay','USD','2025-10-25 16:30:00','completed','UM2024',2,'33f156ec-f1a5-11ef-b32d-7208cff9724e'),(36,1,111,'M',1,60.00,'33f15764-f1a5-11ef-b32d-7208cff9724e','credit_card','USD','2025-11-05 15:00:00','completed','UM2024',1,'33f15782-f1a5-11ef-b32d-7208cff9724e'),(37,2,112,'L',2,90.00,'33f157fa-f1a5-11ef-b32d-7208cff9724e','debit_card','USD','2025-12-10 19:30:00','completed','UM2024',2,'33f1580e-f1a5-11ef-b32d-7208cff9724e');
/*!40000 ALTER TABLE `item_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_sizes`
--

DROP TABLE IF EXISTS `item_sizes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_sizes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `size` varchar(50) NOT NULL,
  `quantity` int NOT NULL,
  `dojang_code` varchar(50) NOT NULL DEFAULT 'DEFAULT_DOJANG_CODE',
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `item_sizes_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=195 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_sizes`
--

LOCK TABLES `item_sizes` WRITE;
/*!40000 ALTER TABLE `item_sizes` DISABLE KEYS */;
INSERT INTO `item_sizes` VALUES (166,80,'1',2,'DJ1742123011686'),(167,80,'E',14,'DJ1742123011686'),(168,80,'Q',14,'DJ1742123011686'),(190,70,'1',10,'UM2024'),(191,70,'3',8,'UM2024'),(192,86,'5',25,'UM2024'),(194,87,'5',552,'UM2024');
/*!40000 ALTER TABLE `item_sizes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `category_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `items_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

LOCK TABLES `items` WRITE;
/*!40000 ALTER TABLE `items` DISABLE KEYS */;
INSERT INTO `items` VALUES (37,'Sparring set',210.00,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/DJ1730305859821/71hK8QUTNUL._AC_UL640_FMwebp_QL65_.webp',25,'2024-11-03 01:49:12','DJ1730305859821'),(38,'티셔츠',10.00,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/DJ1730305859821/í°ìì¸ .jpeg',24,'2024-11-13 19:00:41','DJ1730305859821'),(70,'Unifrom',0.01,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/51d29RYctlL._AC_SX679_.jpg',11,'2025-03-01 13:28:17','UM2024'),(80,'Sparring gear',2.00,NULL,37,'2025-03-18 03:15:37','DJ1742123011686'),(86,'ㅂ',1.00,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/2283b320-b919-400b-8ffa-8de07a5f477f.jpeg',11,'2025-03-23 12:27:33','UM2024'),(87,'ㄱ',4.00,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/3a3b88be-81cc-4ec4-8db6-66c7f6598912.jpeg',12,'2025-03-23 12:28:03','UM2024');
/*!40000 ALTER TABLE `items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monthly_payments`
--

DROP TABLE IF EXISTS `monthly_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monthly_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_id` int NOT NULL,
  `student_id` int NOT NULL,
  `program_id` int NOT NULL,
  `payment_date` date NOT NULL,
  `next_payment_date` date DEFAULT NULL,
  `last_payment_date` date DEFAULT NULL,
  `payment_status` enum('pending','completed','failed') DEFAULT 'pending',
  `status` enum('pending','completed','failed') DEFAULT 'pending',
  `dojang_code` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `source_id` varchar(255) NOT NULL,
  `customer_id` varchar(50) DEFAULT NULL,
  `idempotency_key` varchar(255) NOT NULL,
  `payment_id` varchar(255) NOT NULL,
  `program_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `parent_id` (`parent_id`),
  KEY `student_id` (`student_id`),
  KEY `program_id` (`program_id`),
  CONSTRAINT `monthly_payments_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `parents` (`id`),
  CONSTRAINT `monthly_payments_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `monthly_payments_ibfk_3` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monthly_payments`
--

LOCK TABLES `monthly_payments` WRITE;
/*!40000 ALTER TABLE `monthly_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `monthly_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojang_code` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `date` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_read` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (97,'UM2024','Class updated for 진여 엄. \n      New classes: Mon-3:20~3:50, Thur-3:20~3:50','2025-03-23 19:53:47',0),(98,'UM2024','Class updated for D Un. \n      New classes: Mon-3:20~3:50, Thur-3:20~3:50','2025-03-23 19:54:08',0),(99,'UM2024','Class updated for Jay Um. \n      New classes: Mon-3:20~3:50, Thur-3:20~3:50','2025-03-23 19:54:17',0);
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_bank_accounts`
--

DROP TABLE IF EXISTS `owner_bank_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_bank_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojang_code` varchar(255) NOT NULL,
  `bank_name` varchar(255) DEFAULT 'Unknown Bank',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `square_access_token` varchar(255) DEFAULT NULL,
  `merchant_id` varchar(255) DEFAULT NULL,
  `scope` text,
  `refresh_token` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_bank_accounts`
--

LOCK TABLES `owner_bank_accounts` WRITE;
/*!40000 ALTER TABLE `owner_bank_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `owner_bank_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ownercodes`
--

DROP TABLE IF EXISTS `ownercodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ownercodes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `owner_code` varchar(20) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ownercodes`
--

LOCK TABLES `ownercodes` WRITE;
/*!40000 ALTER TABLE `ownercodes` DISABLE KEYS */;
/*!40000 ALTER TABLE `ownercodes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parents`
--

DROP TABLE IF EXISTS `parents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('parent') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `customer_id` varchar(255) DEFAULT NULL,
  `dojang_code` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parents`
--

LOCK TABLES `parents` WRITE;
/*!40000 ALTER TABLE `parents` DISABLE KEYS */;
INSERT INTO `parents` VALUES (2,'vstaekwondo.um@gmail.com','$2b$10$2micGfaQtWfODseVieyiKuxtusD3owfNl/qrovgyrIUcgjF1Q9Ccy','parent','2024-10-11 09:14:49','Jaehyun','Um','1991-03-15','male','4046901615','A4S1BF9XYK900XRRRJHKGM585W','UM2024'),(3,'jctkd.jh@gmail.com','$2b$10$s0MeRoCWthI4mwcBYhLB/em6EgjHXQ2VupU9HGT0UnjPyBUaNuB12','parent','2024-10-31 03:49:31','k','k','1991-03-08','male','4046901615','3P9FH5VFGWTTX82C2CH3V4R0FC','DJ1730305859821'),(5,'jaehyunum9@gmail.com','$2b$10$3AKs5OjmZMywcqEnTVo75Od9BSAymBUnxdEoRvFq6xVUmzTicYXaO','parent','2025-02-26 15:25:04','J','U','1991-03-08','male','4046901615','86C51JEFQS34J5R8FG64MH1AM0','UM2024'),(6,'saehan.jh@gmail.com','$2b$10$nvAx9GWegAHKb0aQnlIWpu88PzStffsfkxnmgi0hnaRhcdbmnCh7O','parent','2025-03-16 11:55:54','J','H','1991-03-08','male','4046901615',NULL,'DJ1742123011686');
/*!40000 ALTER TABLE `parents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_id` varchar(255) NOT NULL,
  `student_id` int NOT NULL,
  `item_id` int DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `program_id` int DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `payment_method` varchar(50) DEFAULT NULL,
  `card_id` varchar(255) DEFAULT NULL,
  `status` enum('pending','completed','failed') NOT NULL,
  `payment_intent_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `dojang_code` varchar(255) DEFAULT NULL,
  `idempotency_key` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (88,'',29,NULL,NULL,16,14500.00,'USD','credit_card',NULL,'completed',NULL,'2024-10-28 00:48:32','UM2024',NULL),(89,'',28,NULL,NULL,16,14500.00,'USD','credit_card',NULL,'completed',NULL,'2024-10-28 00:56:27','UM2024',NULL),(90,'',29,NULL,NULL,16,14500.00,'USD','credit_card',NULL,'completed',NULL,'2024-10-28 00:59:11','UM2024',NULL),(91,'',4,29,NULL,15,60.00,'USD',NULL,NULL,'completed',NULL,'2024-10-28 02:58:13','UM2024',NULL),(92,'',4,31,NULL,15,200.00,'USD',NULL,NULL,'completed',NULL,'2024-10-28 03:03:32','UM2024',NULL),(93,'',27,31,NULL,16,200.00,'USD',NULL,NULL,'completed',NULL,'2024-10-28 03:10:23','UM2024',NULL),(94,'',4,29,NULL,15,60.00,'USD',NULL,NULL,'completed',NULL,'2024-10-28 18:52:41','UM2024',NULL),(95,'',31,NULL,NULL,30,4900.00,'USD','credit_card',NULL,'completed',NULL,'2024-11-03 05:07:42','DJ1730305859821',NULL),(96,'',32,NULL,NULL,30,4900.00,'USD','credit_card',NULL,'completed',NULL,'2024-11-03 05:11:28','DJ1730305859821',NULL),(97,'',30,NULL,NULL,30,4900.00,'USD','credit_card',NULL,'completed',NULL,'2024-11-03 05:24:28','DJ1730305859821',NULL),(98,'',34,NULL,NULL,30,4900.00,'USD','credit_card',NULL,'completed',NULL,'2024-11-03 06:17:22','DJ1730305859821',NULL),(99,'',38,NULL,NULL,30,4900.00,'USD','credit_card',NULL,'completed',NULL,'2024-11-03 06:34:18','DJ1730305859821',NULL),(100,'',30,36,NULL,30,60.00,'USD',NULL,NULL,'completed',NULL,'2024-11-03 14:26:34','DJ1730305859821',NULL),(101,'cnon:CBASELmQzpSPC_ZhNWN1KZHOS6goAg',30,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-04 03:00:08','DJ1730305859821','30-1730689208228'),(102,'cnon:CBASEMKYfiqgUF1ertZuiVnIzy8oAg',30,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-04 03:13:34','DJ1730305859821','30-1730690014850'),(103,'cnon:CBASEKg6GL9T6F2j7Qa4wRrhBsMoAg',30,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-04 03:13:50','DJ1730305859821','30-1730690030374'),(104,'cnon:CBASEJ1a8gdpvhQp5FdGdySHpLQoAg',30,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-04 03:15:34','DJ1730305859821','30-1730690134237'),(105,'cnon:CBASEFEmq3fWmlhXy2BoAU1bOpgoAg',31,NULL,NULL,NULL,7000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-04 03:23:55','DJ1730305859821','31-1730690635870'),(106,'cnon:CBASEHcly70AMQbr-pv8MgM0crUoAg',38,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-04 03:35:00','DJ1730305859821','38-1730691300706'),(107,'cnon:CBASEAf3oPB94ru_DtW-oD3Z8n0oAg',30,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-05 17:42:44','DJ1730305859821','30-1730828564278'),(108,'cnon:CBASEB9NNcZZ9Tx_scFOFy5ZGc8oAg',30,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-05 17:52:27','DJ1730305859821','30-1730829147717'),(109,'cnon:CBASEAFrAOmK2_DtZ-76E6STIiIoAg',32,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-05 18:40:19','DJ1730305859821','32-1730832018976'),(110,'cnon:CBASENCDUa9N7_OL0nWjcwmcCqUoAg',34,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-05 18:40:57','DJ1730305859821','34-1730832057884'),(111,'cnon:CBASENDM7PV1LOoUYyvNoDzZs4AoAg',38,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-05 18:53:08','DJ1730305859821','38-1730832788461'),(112,'cnon:CA4SEFX4l6RQU2N7Tb-wCPQChJ8YASgC',30,NULL,NULL,NULL,6000.00,'USD','credit_card',NULL,'pending',NULL,'2024-11-07 01:25:09','DJ1730305859821','30-1730942709011');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `program_payments`
--

DROP TABLE IF EXISTS `program_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `program_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payment_id` varchar(255) NOT NULL,
  `source_id` varchar(255) NOT NULL,
  `program_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','completed','failed') NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `idempotency_key` varchar(255) NOT NULL,
  `parent_id` int DEFAULT NULL,
  `student_id` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=152 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `program_payments`
--

LOCK TABLES `program_payments` WRITE;
/*!40000 ALTER TABLE `program_payments` DISABLE KEYS */;
INSERT INTO `program_payments` VALUES (142,'6a5c8758-fc5c-11ef-80e2-c25563f29511','test-source-1',52,50.00,'2025-03-08 17:00:00','completed','UM2024','6a5c8c1c-fc5c-11ef-80e2-c25563f29511',2,68),(144,'6a5d4f30-fc5c-11ef-80e2-c25563f29511','test-source-3',52,100.00,'2025-03-08 20:00:00','completed','UM2024','6a5d4f58-fc5c-11ef-80e2-c25563f29511',2,70),(145,'38a3fa9c-fc5d-11ef-80e2-c25563f29511','test-source-68',52,120.00,'2025-03-08 17:00:00','completed','UM2024','38a3fe0c-fc5d-11ef-80e2-c25563f29511',2,68),(147,'38a444de-fc5d-11ef-80e2-c25563f29511','test-source-70',52,140.00,'2025-03-08 20:00:00','completed','UM2024','38a44524-fc5d-11ef-80e2-c25563f29511',2,70);
/*!40000 ALTER TABLE `program_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `programs`
--

DROP TABLE IF EXISTS `programs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `programs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `payment_type` enum('pay_in_full','monthly_pay') NOT NULL,
  `operation_type` enum('class_based','duration_based') DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `total_classes` int DEFAULT NULL,
  `classes_per_week` int DEFAULT NULL,
  `duration_months` int DEFAULT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `registration_fee` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `programs`
--

LOCK TABLES `programs` WRITE;
/*!40000 ALTER TABLE `programs` DISABLE KEYS */;
INSERT INTO `programs` VALUES (52,'Regular Program ','2 classes per week / Free Birthday party','monthly_pay','duration_based',129.00,NULL,2,12,'UM2024',100.00),(53,'Regular','유니폼 60불','monthly_pay','duration_based',0.01,NULL,2,12,'DJ1742123011686',0.01);
/*!40000 ALTER TABLE `programs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saved_cards`
--

DROP TABLE IF EXISTS `saved_cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_id` varchar(50) DEFAULT NULL,
  `card_name` varchar(50) NOT NULL,
  `expiration` varchar(7) NOT NULL,
  `card_token` varchar(100) NOT NULL,
  `card_brand` varchar(20) DEFAULT NULL,
  `dojang_code` varchar(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `customer_id` varchar(255) DEFAULT NULL,
  `card_id` varchar(50) NOT NULL,
  `last_four` varchar(4) DEFAULT NULL,
  `owner_id` int DEFAULT NULL,
  `payment_policy_agreed` tinyint(1) DEFAULT '0',
  `payment_policy_agreed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `saved_cards`
--

LOCK TABLES `saved_cards` WRITE;
/*!40000 ALTER TABLE `saved_cards` DISABLE KEYS */;
INSERT INTO `saved_cards` VALUES (15,'2','John Doe','12/26','tok_abc123xyz','Visa','UM2024','2025-03-20 23:52:10','cus_789xyz','card_123456','4242',1,0,NULL);
/*!40000 ALTER TABLE `saved_cards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule`
--

DROP TABLE IF EXISTS `schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `time` varchar(50) DEFAULT NULL,
  `Mon` varchar(255) DEFAULT '',
  `Tue` varchar(255) DEFAULT '',
  `Wed` varchar(255) DEFAULT '',
  `Thur` varchar(255) DEFAULT '',
  `Fri` varchar(255) DEFAULT '',
  `Sat` varchar(255) DEFAULT '',
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=354 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule`
--

LOCK TABLES `schedule` WRITE;
/*!40000 ALTER TABLE `schedule` DISABLE KEYS */;
INSERT INTO `schedule` VALUES (349,'3:00~4:00','Level 1','Level 2','Level 3','Test1','Belt test','Promotion belt','DJ1742123011686'),(352,'3:20~3:50','Level 1',NULL,'Level 3','Level 1',NULL,NULL,'UM2024'),(353,'4:00~5:00',NULL,'Promotion',NULL,NULL,'Test',NULL,'UM2024');
/*!40000 ALTER TABLE `schedule` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `add_class_details` AFTER INSERT ON `schedule` FOR EACH ROW BEGIN
    IF NEW.Mon IS NOT NULL THEN
        INSERT INTO class_details (day, time, classname, dojang_code)
        VALUES ('Mon', NEW.time, NEW.Mon, NEW.dojang_code);
    END IF;

    IF NEW.Tue IS NOT NULL THEN
        INSERT INTO class_details (day, time, classname, dojang_code)
        VALUES ('Tue', NEW.time, NEW.Tue, NEW.dojang_code);
    END IF;

    IF NEW.Wed IS NOT NULL THEN
        INSERT INTO class_details (day, time, classname, dojang_code)
        VALUES ('Wed', NEW.time, NEW.Wed, NEW.dojang_code);
    END IF;

    IF NEW.Thur IS NOT NULL THEN
        INSERT INTO class_details (day, time, classname, dojang_code)
        VALUES ('Thur', NEW.time, NEW.Thur, NEW.dojang_code);
    END IF;

    IF NEW.Fri IS NOT NULL THEN
        INSERT INTO class_details (day, time, classname, dojang_code)
        VALUES ('Fri', NEW.time, NEW.Fri, NEW.dojang_code);
    END IF;

    IF NEW.Sat IS NOT NULL THEN
        INSERT INTO class_details (day, time, classname, dojang_code)
        VALUES ('Sat', NEW.time, NEW.Sat, NEW.dojang_code);
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `update_class_details_after_schedule_update` AFTER UPDATE ON `schedule` FOR EACH ROW BEGIN

  -- MON
  IF NEW.Mon IS NULL OR NEW.Mon = '' THEN
    DELETE FROM class_details WHERE day = 'Mon' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSEIF NEW.Mon <> OLD.Mon THEN
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Mon' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details SET classname = NEW.Mon WHERE day = 'Mon' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) VALUES ('Mon', NEW.time, NEW.Mon, NEW.dojang_code);
    END IF;
  END IF;

  -- TUE
  IF NEW.Tue IS NULL OR NEW.Tue = '' THEN
    DELETE FROM class_details WHERE day = 'Tue' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSEIF NEW.Tue <> OLD.Tue THEN
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Tue' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details SET classname = NEW.Tue WHERE day = 'Tue' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) VALUES ('Tue', NEW.time, NEW.Tue, NEW.dojang_code);
    END IF;
  END IF;

  -- WED
  IF NEW.Wed IS NULL OR NEW.Wed = '' THEN
    DELETE FROM class_details WHERE day = 'Wed' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSEIF NEW.Wed <> OLD.Wed THEN
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Wed' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details SET classname = NEW.Wed WHERE day = 'Wed' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) VALUES ('Wed', NEW.time, NEW.Wed, NEW.dojang_code);
    END IF;
  END IF;

  -- THUR
  IF NEW.Thur IS NULL OR NEW.Thur = '' THEN
    DELETE FROM class_details WHERE day = 'Thur' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSEIF NEW.Thur <> OLD.Thur THEN
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Thur' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details SET classname = NEW.Thur WHERE day = 'Thur' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) VALUES ('Thur', NEW.time, NEW.Thur, NEW.dojang_code);
    END IF;
  END IF;

  -- FRI
  IF NEW.Fri IS NULL OR NEW.Fri = '' THEN
    DELETE FROM class_details WHERE day = 'Fri' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSEIF NEW.Fri <> OLD.Fri THEN
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Fri' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details SET classname = NEW.Fri WHERE day = 'Fri' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) VALUES ('Fri', NEW.time, NEW.Fri, NEW.dojang_code);
    END IF;
  END IF;

  -- SAT
  IF NEW.Sat IS NULL OR NEW.Sat = '' THEN
    DELETE FROM class_details WHERE day = 'Sat' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSEIF NEW.Sat <> OLD.Sat THEN
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Sat' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details SET classname = NEW.Sat WHERE day = 'Sat' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) VALUES ('Sat', NEW.time, NEW.Sat, NEW.dojang_code);
    END IF;
  END IF;

END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `update_or_delete_class_details_after_schedule_update` AFTER UPDATE ON `schedule` FOR EACH ROW BEGIN

  -- MON
  IF NEW.Mon IS NULL OR NEW.Mon = '' THEN
    DELETE FROM class_details WHERE day = 'Mon' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSE
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Mon' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details 
      SET classname = NEW.Mon 
      WHERE day = 'Mon' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) 
      VALUES ('Mon', NEW.time, NEW.Mon, NEW.dojang_code);
    END IF;
  END IF;

  -- TUE
  IF NEW.Tue IS NULL OR NEW.Tue = '' THEN
    DELETE FROM class_details WHERE day = 'Tue' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSE
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Tue' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details 
      SET classname = NEW.Tue 
      WHERE day = 'Tue' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) 
      VALUES ('Tue', NEW.time, NEW.Tue, NEW.dojang_code);
    END IF;
  END IF;

  -- WED
  IF NEW.Wed IS NULL OR NEW.Wed = '' THEN
    DELETE FROM class_details WHERE day = 'Wed' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSE
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Wed' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details 
      SET classname = NEW.Wed 
      WHERE day = 'Wed' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) 
      VALUES ('Wed', NEW.time, NEW.Wed, NEW.dojang_code);
    END IF;
  END IF;

  -- THUR
  IF NEW.Thur IS NULL OR NEW.Thur = '' THEN
    DELETE FROM class_details WHERE day = 'Thur' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSE
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Thur' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details 
      SET classname = NEW.Thur 
      WHERE day = 'Thur' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) 
      VALUES ('Thur', NEW.time, NEW.Thur, NEW.dojang_code);
    END IF;
  END IF;

  -- FRI
  IF NEW.Fri IS NULL OR NEW.Fri = '' THEN
    DELETE FROM class_details WHERE day = 'Fri' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSE
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Fri' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details 
      SET classname = NEW.Fri 
      WHERE day = 'Fri' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) 
      VALUES ('Fri', NEW.time, NEW.Fri, NEW.dojang_code);
    END IF;
  END IF;

  -- SAT
  IF NEW.Sat IS NULL OR NEW.Sat = '' THEN
    DELETE FROM class_details WHERE day = 'Sat' AND time = NEW.time AND dojang_code = NEW.dojang_code;
  ELSE
    IF EXISTS (SELECT 1 FROM class_details WHERE day = 'Sat' AND time = NEW.time AND dojang_code = NEW.dojang_code) THEN
      UPDATE class_details 
      SET classname = NEW.Sat 
      WHERE day = 'Sat' AND time = NEW.time AND dojang_code = NEW.dojang_code;
    ELSE
      INSERT INTO class_details (day, time, classname, dojang_code) 
      VALUES ('Sat', NEW.time, NEW.Sat, NEW.dojang_code);
    END IF;
  END IF;

END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `delete_class_details` AFTER DELETE ON `schedule` FOR EACH ROW BEGIN
    DELETE FROM class_details 
    WHERE time = OLD.time AND dojang_code = OLD.dojang_code;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `sparring_schedule`
--

DROP TABLE IF EXISTS `sparring_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sparring_schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`,`dojang_code`),
  UNIQUE KEY `unique_date_dojang` (`date`,`dojang_code`)
) ENGINE=InnoDB AUTO_INCREMENT=603 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sparring_schedule`
--

LOCK TABLES `sparring_schedule` WRITE;
/*!40000 ALTER TABLE `sparring_schedule` DISABLE KEYS */;
INSERT INTO `sparring_schedule` VALUES (486,'2024-10-08','DJ1730305859821'),(487,'2024-10-09','DJ1730305859821'),(488,'2024-10-10','DJ1730305859821'),(489,'2024-10-11','DJ1730305859821'),(490,'2024-10-12','DJ1730305859821'),(485,'2024-10-15','DJ1730305859821'),(426,'2024-10-15','UM2024'),(484,'2024-10-16','DJ1730305859821'),(427,'2024-10-16','UM2024'),(432,'2024-10-17','DJ1730305859821'),(428,'2024-10-17','UM2024'),(433,'2024-10-18','DJ1730305859821'),(430,'2024-10-18','UM2024'),(435,'2024-10-19','DJ1730305859821'),(429,'2024-10-19','UM2024'),(492,'2024-11-05','DJ1730305859821'),(491,'2024-11-06','DJ1730305859821'),(493,'2024-11-07','DJ1730305859821'),(494,'2024-11-08','DJ1730305859821'),(505,'2025-03-04','UM2024'),(507,'2025-03-05','UM2024'),(597,'2025-03-06','DJ1742123011686'),(508,'2025-03-06','UM2024'),(592,'2025-03-10','DJ1742123011686'),(594,'2025-03-11','DJ1742123011686'),(601,'2025-03-11','UM2024'),(596,'2025-03-12','DJ1742123011686'),(506,'2025-03-12','UM2024'),(598,'2025-03-13','DJ1742123011686'),(600,'2025-03-13','UM2024'),(599,'2025-03-14','UM2024'),(575,'2025-03-17','DJ1742123011686'),(576,'2025-03-18','DJ1742123011686'),(602,'2025-03-18','UM2024'),(577,'2025-03-19','DJ1742123011686'),(578,'2025-03-20','DJ1742123011686'),(579,'2025-03-21','DJ1742123011686'),(590,'2025-03-24','DJ1742123011686'),(581,'2025-03-25','DJ1742123011686'),(582,'2025-03-26','DJ1742123011686'),(580,'2025-03-27','DJ1742123011686');
/*!40000 ALTER TABLE `sparring_schedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_classes`
--

DROP TABLE IF EXISTS `student_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int DEFAULT NULL,
  `class_id` int DEFAULT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `student_classes_ibfk_2` (`class_id`),
  CONSTRAINT `student_classes_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `student_classes_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `class_details` (`class_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=709 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_classes`
--

LOCK TABLES `student_classes` WRITE;
/*!40000 ALTER TABLE `student_classes` DISABLE KEYS */;
INSERT INTO `student_classes` VALUES (699,102,2691,'UM2024'),(700,102,2685,'UM2024'),(701,112,2691,'UM2024'),(702,112,2685,'UM2024'),(703,70,2691,'UM2024'),(704,70,2685,'UM2024'),(705,113,2691,'UM2024'),(706,113,2685,'UM2024'),(707,114,2691,'UM2024'),(708,114,2685,'UM2024');
/*!40000 ALTER TABLE `student_classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_growth`
--

DROP TABLE IF EXISTS `student_growth`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_growth` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `month` varchar(7) NOT NULL,
  `registered_students` int DEFAULT '0',
  `cumulative_students` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `dojang_code` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_growth`
--

LOCK TABLES `student_growth` WRITE;
/*!40000 ALTER TABLE `student_growth` DISABLE KEYS */;
INSERT INTO `student_growth` VALUES (34,2,'2025-03',9,7,'2025-03-20 16:57:47','2025-03-23 05:08:57','UM2024'),(35,5,'2025-03',10,17,'2025-03-23 13:52:32','2025-03-23 13:53:36','UM2024'),(36,3,'2025-03',5,5,'2025-03-23 14:01:28','2025-03-23 14:01:29','DJ1730305859821'),(37,2,'2025-01',5,5,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(38,2,'2025-02',6,11,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(39,2,'2025-03',9,20,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(40,2,'2025-04',7,27,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(41,2,'2025-05',8,35,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(42,2,'2025-06',10,45,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(43,2,'2025-07',11,56,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(44,2,'2025-08',6,62,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(45,2,'2025-09',9,71,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(46,2,'2025-10',8,79,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(47,2,'2025-11',7,86,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(48,2,'2025-12',10,96,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(49,5,'2025-01',4,4,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(50,5,'2025-02',7,11,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(51,5,'2025-03',10,21,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(52,5,'2025-04',6,27,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(53,5,'2025-05',9,36,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(54,5,'2025-06',5,41,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(55,5,'2025-07',12,53,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(56,5,'2025-08',8,61,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(57,5,'2025-09',7,68,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(58,5,'2025-10',10,78,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(59,5,'2025-11',9,87,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024'),(60,5,'2025-12',11,98,'2025-03-23 19:55:17','2025-03-23 19:55:17','UM2024');
/*!40000 ALTER TABLE `student_growth` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_programs`
--

DROP TABLE IF EXISTS `student_programs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_programs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `program_id` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `payment_type` enum('pay_in_full','monthly') NOT NULL,
  `payment_status` enum('completed','active','canceled') DEFAULT 'active',
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `program_id` (`program_id`),
  CONSTRAINT `student_programs_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `student_programs_ibfk_2` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_programs`
--

LOCK TABLES `student_programs` WRITE;
/*!40000 ALTER TABLE `student_programs` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_programs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_id` int DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `belt_rank` varchar(50) DEFAULT NULL,
  `program_id` int DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `belt_size` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `students_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `Parents` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES (70,2,'진여','엄','2017-03-08','male','2',52,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/profile.jpg','UM2024','4','2025-02-21 03:42:55'),(101,2,'서준','엄','2017-06-15','male','3',16,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/profile.jpg','UM2024','4','2025-03-19 17:02:14'),(102,2,'민서','엄','2019-01-20','female','3',52,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/profile.jpg','UM2024','4','2025-03-19 17:02:14'),(112,2,'지우','엄','2016-09-05','male','5',52,'https://mydojangbucket.s3.us-east-2.amazonaws.com/uploads/UM2024/profile.jpg','UM2024','5','2025-03-21 02:16:36'),(113,2,'D','Un','2018-03-21','male','1',52,NULL,'UM2024','4','2025-03-21 02:25:12'),(114,2,'Jay','Um','2016-03-23','male','1',52,NULL,'UM2024','4','2025-03-23 04:15:45'),(115,2,'5','T','2017-03-23','male','1',52,NULL,'UM2024','4','2025-03-23 05:08:57'),(116,5,'Sophia','Johnson','2014-07-22','male','2',2,NULL,'UM2024','S','2025-03-23 13:52:32'),(117,5,'William','Jones','2014-08-15','male','2',2,NULL,'UM2024','M','2025-03-23 13:53:35'),(118,5,'Isabella','Garcia','2015-05-27','female','1',2,NULL,'UM2024','S','2025-03-23 13:53:35'),(119,5,'Henry','Martinez','2016-01-12','male','0',1,NULL,'UM2024','XS','2025-03-23 13:53:35'),(120,5,'Mia','Robinson','2013-07-29','female','3',3,NULL,'UM2024','M','2025-03-23 13:53:35'),(121,5,'Benjamin','Clark','2014-12-08','male','2',2,NULL,'UM2024','S','2025-03-23 13:53:35'),(122,5,'Lily','Rodriguez','2016-09-03','female','1',2,NULL,'UM2024','XS','2025-03-23 13:53:35'),(123,5,'Jacob','Lewis','2015-02-18','male','2',2,NULL,'UM2024','S','2025-03-23 13:53:35'),(124,5,'Harper','Lee','2013-10-21','female','4',3,NULL,'UM2024','M','2025-03-23 13:53:35'),(125,5,'Daniel','Walker','2014-03-30','male','3',3,NULL,'UM2024','M','2025-03-23 13:53:36'),(126,3,'Michael','Park','2014-05-15','male','3',2,NULL,'DJ1730305859821','M','2025-03-23 14:01:28'),(127,3,'Sophia','Kim','2015-08-21','female','2',2,NULL,'DJ1730305859821','S','2025-03-23 14:01:28'),(128,3,'Ethan','Lee','2013-11-30','male','4',3,NULL,'DJ1730305859821','M','2025-03-23 14:01:28'),(129,3,'Olivia','Choi','2016-04-17','female','1',1,NULL,'DJ1730305859821','XS','2025-03-23 14:01:28'),(130,3,'Noah','Kang','2015-02-03','male','2',2,NULL,'DJ1730305859821','S','2025-03-23 14:01:29');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_student_insert` AFTER INSERT ON `students` FOR EACH ROW BEGIN
  DECLARE current_month VARCHAR(7);
  DECLARE cumulative_count INT;

  -- 현재 월 가져오기 (YYYY-MM 형식)
  SET current_month = DATE_FORMAT(NOW(), '%Y-%m');

  -- 누적 학생 수 가져오기 (현재 도장 기준)
  SELECT COUNT(*) INTO cumulative_count 
  FROM students 
  WHERE dojang_code = NEW.dojang_code;

  -- 기존 student_growth에 동일 parent_id + 월 데이터 있는지 체크
  IF EXISTS (
    SELECT 1 
    FROM student_growth 
    WHERE month = current_month 
      AND user_id = NEW.parent_id 
      AND dojang_code = NEW.dojang_code
  ) THEN
    -- 기존 row 업데이트 (updated_at 갱신 포함)
    UPDATE student_growth
    SET registered_students = registered_students + 1, 
        cumulative_students = cumulative_count,
        updated_at = NOW()
    WHERE month = current_month 
      AND user_id = NEW.parent_id
      AND dojang_code = NEW.dojang_code;
  ELSE
    -- 신규 row 삽입
    INSERT INTO student_growth 
    (user_id, month, registered_students, cumulative_students, dojang_code, created_at, updated_at)
    VALUES 
    (NEW.parent_id, current_month, 1, cumulative_count, NEW.dojang_code, NOW(), NOW());
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_student_delete` AFTER DELETE ON `students` FOR EACH ROW BEGIN
  INSERT INTO subscription_cancellations (first_name, last_name, dojang_code, canceled_at)
  VALUES (OLD.first_name, OLD.last_name, OLD.dojang_code, NOW());
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `subscription_cancellations`
--

DROP TABLE IF EXISTS `subscription_cancellations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_cancellations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojang_code` varchar(50) NOT NULL,
  `canceled_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscription_cancellations`
--

LOCK TABLES `subscription_cancellations` WRITE;
/*!40000 ALTER TABLE `subscription_cancellations` DISABLE KEYS */;
INSERT INTO `subscription_cancellations` VALUES (32,'UM2024','2025-03-20 13:33:20','테스트5','최'),(33,'UM2024','2025-03-20 13:33:24','테스트4','이'),(34,'UM2024','2025-03-20 13:35:48','테스트3','박'),(35,'UM2024','2025-03-20 13:35:51','테스트2','김'),(36,'UM2024','2025-03-20 13:35:57','테스트','홍'),(37,'UM2024','2025-03-23 00:17:42','영진','엄'),(38,'UM2024','2025-03-23 00:53:17','지우','엄');
/*!40000 ALTER TABLE `subscription_cancellations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `customer_id` varchar(255) NOT NULL,
  `subscription_id` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL,
  `next_billing_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_fee`
--

DROP TABLE IF EXISTS `test_fee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_fee` (
  `id` int NOT NULL AUTO_INCREMENT,
  `belt_min_rank` int NOT NULL,
  `belt_max_rank` int NOT NULL,
  `fee` decimal(10,2) NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_fee`
--

LOCK TABLES `test_fee` WRITE;
/*!40000 ALTER TABLE `test_fee` DISABLE KEYS */;
INSERT INTO `test_fee` VALUES (13,1,3,60.00,'DJ1730305859821'),(14,4,9,70.00,'DJ1730305859821'),(15,10,14,80.00,'DJ1730305859821'),(26,1,3,1.00,'DJ1742123011686'),(27,2,5,3.00,'DJ1742123011686'),(28,1,3,60.00,'UM2024'),(29,4,8,70.00,'UM2024'),(30,9,12,80.00,'UM2024');
/*!40000 ALTER TABLE `test_fee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_payments`
--

DROP TABLE IF EXISTS `test_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_id` varchar(255) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','completed','failed') NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `idempotency_key` varchar(255) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `card_id` varchar(255) DEFAULT NULL,
  `student_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idempotency_key` (`idempotency_key`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_payments`
--

LOCK TABLES `test_payments` WRITE;
/*!40000 ALTER TABLE `test_payments` DISABLE KEYS */;
INSERT INTO `test_payments` VALUES (1,'cnon:CA4SEDjMLDark4aQ72Aqqz8_PGkYASgC',6000.00,'2024-11-08 17:13:17','pending','DJ1730305859821','e3fafd87-b846-4630-8205-e1d1c3d36d30','credit_card','USD',NULL,NULL,0),(2,'cnon:CA4SEN7_x_hvDftahxv5trO841QYASgC',7000.00,'2024-11-08 17:28:40','pending','DJ1730305859821','e11dfe57-8756-4e01-b36b-b231c1489a30','credit_card','USD',3,NULL,0),(3,'cnon:CA4SEMf4KRixq7JQK5j1Zlbg2_MYASgC',7000.00,'2024-11-10 22:16:50','pending','DJ1730305859821','44c64c44-4c34-4836-890f-a95e96db6f2d','credit_card','USD',3,NULL,0),(4,'cnon:CA4SEJcslMLBoF-jeOHZhVnARm4YASgC',6000.00,'2024-11-10 22:18:00','pending','DJ1730305859821','a6d63d1c-0f13-48aa-be2f-9ceeb8f81cab','credit_card','USD',3,NULL,0),(5,'cnon:CA4SENOXBZW-YM5j_qp-i5nHgiEYASgC',6000.00,'2024-11-11 04:21:52','pending','DJ1730305859821','7c273dda-8386-45a6-ac7e-3d240cccc667','credit_card','USD',3,NULL,0),(6,'cnon:CA4SEMiWLKCvZGb6uuxqA0MJSxEYASgC',6000.00,'2024-11-11 04:26:14','completed','DJ1730305859821','1f814fbf-0b17-4f9d-b650-9b04099bae38','credit_card','USD',3,NULL,0),(7,'cnon:CA4SELA9ABCD4E5T0F8Z1234AL1YASgC',5500.00,'2023-10-11 14:15:00','completed','DJ1730305859821','abc123-test','credit_card','USD',3,NULL,0),(8,'cnon:CA4SERFYHTG5TYTYU9XEM5H5PYMYASgC',5000.00,'2023-11-12 19:25:00','completed','DJ1730305859821','def456-test','credit_card','USD',3,NULL,0),(9,'cnon:CA4SEHYTH1JAK1QH76ZYVHYT1GUYASgC',7500.00,'2024-01-13 16:45:00','completed','DJ1730305859821','ghi789-test','credit_card','USD',3,NULL,0),(10,'cnon:CA4SERFDTYUT54UI7T5GT56J6YK9YASgC',6500.00,'2024-02-14 20:05:00','completed','DJ1730305859821','jkl012-test','credit_card','USD',3,NULL,0),(41,'f0b055cc-f1a4-11ef-b32d-7208cff9724e',50.00,'2025-01-10 16:00:00','completed','UM2024','f0b058c4-f1a4-11ef-b32d-7208cff9724e','credit_card','USD',1,'f0b058ce-f1a4-11ef-b32d-7208cff9724e',1),(42,'f0b0667a-f1a4-11ef-b32d-7208cff9724e',75.00,'2025-02-12 17:30:00','completed','UM2024','f0b066a2-f1a4-11ef-b32d-7208cff9724e','debit_card','USD',2,'f0b066ac-f1a4-11ef-b32d-7208cff9724e',2),(43,'f0b06788-f1a4-11ef-b32d-7208cff9724e',60.00,'2025-03-18 19:00:00','completed','UM2024','f0b067a6-f1a4-11ef-b32d-7208cff9724e','paypal','USD',1,'f0b067b0-f1a4-11ef-b32d-7208cff9724e',3),(44,'f0b06904-f1a4-11ef-b32d-7208cff9724e',80.00,'2025-04-22 21:30:00','completed','UM2024','f0b06922-f1a4-11ef-b32d-7208cff9724e','credit_card','USD',3,'f0b0692c-f1a4-11ef-b32d-7208cff9724e',4),(45,'f0b069ea-f1a4-11ef-b32d-7208cff9724e',90.00,'2025-05-30 23:45:00','completed','UM2024','f0b06a08-f1a4-11ef-b32d-7208cff9724e','apple_pay','USD',2,'f0b06a12-f1a4-11ef-b32d-7208cff9724e',5),(46,'7fa8368c-f1a5-11ef-b32d-7208cff9724e',65.00,'2025-06-10 15:00:00','completed','UM2024','7fa83948-f1a5-11ef-b32d-7208cff9724e','credit_card','USD',1,'7fa83952-f1a5-11ef-b32d-7208cff9724e',1),(47,'7fa86efe-f1a5-11ef-b32d-7208cff9724e',85.00,'2025-07-12 16:30:00','completed','UM2024','7fa86f3a-f1a5-11ef-b32d-7208cff9724e','debit_card','USD',2,'7fa86f44-f1a5-11ef-b32d-7208cff9724e',2),(48,'7fa87034-f1a5-11ef-b32d-7208cff9724e',70.00,'2025-08-18 19:00:00','completed','UM2024','7fa8705c-f1a5-11ef-b32d-7208cff9724e','paypal','USD',1,'7fa8705d-f1a5-11ef-b32d-7208cff9724e',3),(49,'7fa87246-f1a5-11ef-b32d-7208cff9724e',90.00,'2025-09-22 21:30:00','completed','UM2024','7fa87264-f1a5-11ef-b32d-7208cff9724e','credit_card','USD',3,'7fa8726e-f1a5-11ef-b32d-7208cff9724e',4),(50,'7fa8732c-f1a5-11ef-b32d-7208cff9724e',100.00,'2025-10-30 23:45:00','completed','UM2024','7fa8734a-f1a5-11ef-b32d-7208cff9724e','apple_pay','USD',2,'7fa87354-f1a5-11ef-b32d-7208cff9724e',5),(51,'7fa873fe-f1a5-11ef-b32d-7208cff9724e',110.00,'2025-11-05 18:00:00','completed','UM2024','7fa8741c-f1a5-11ef-b32d-7208cff9724e','credit_card','USD',1,'7fa87426-f1a5-11ef-b32d-7208cff9724e',1),(52,'7fa874c6-f1a5-11ef-b32d-7208cff9724e',120.00,'2025-12-10 20:45:00','completed','UM2024','7fa874e4-f1a5-11ef-b32d-7208cff9724e','debit_card','USD',2,'7fa874e5-f1a5-11ef-b32d-7208cff9724e',2),(53,NULL,0.01,'2025-02-26 15:00:51','completed','UM2024','6fc21c07-95bf-4091-936e-46166b4df9d6',NULL,'USD',2,'ccof:CA4SEIFN4o-SY5j27UtfTDKdoRYoAQ',68),(54,'test-source-1',50.00,'2025-03-08 17:00:00','completed','UM2024','2120f86c-fc5c-11ef-80e2-c25563f29511','credit_card','USD',1,'2120f89e-fc5c-11ef-80e2-c25563f29511',68),(55,'test-source-2',75.00,'2025-03-08 18:30:00','completed','UM2024','21232a10-fc5c-11ef-80e2-c25563f29511','debit_card','USD',2,'21232a2e-fc5c-11ef-80e2-c25563f29511',69),(56,'test-source-3',100.00,'2025-03-08 20:00:00','completed','UM2024','21232f1a-fc5c-11ef-80e2-c25563f29511','paypal','USD',3,'21232f24-fc5c-11ef-80e2-c25563f29511',70);
/*!40000 ALTER TABLE `test_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_template`
--

DROP TABLE IF EXISTS `test_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojang_code` varchar(50) NOT NULL,
  `test_name` varchar(255) NOT NULL,
  `test_type` enum('score','count','time') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `duration` int DEFAULT NULL,
  `target_count` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_template`
--

LOCK TABLES `test_template` WRITE;
/*!40000 ALTER TABLE `test_template` DISABLE KEYS */;
INSERT INTO `test_template` VALUES (1,'UM2024','Punching','score','2025-03-05 16:31:57',NULL,NULL),(2,'UM2024','Kicking combination','score','2025-03-05 16:32:13',NULL,NULL),(3,'UM2024','Sparring','score','2025-03-05 16:34:53',NULL,NULL),(5,'UM2024','Form','score','2025-03-05 17:14:03',NULL,NULL),(6,'UM2024','Speed kick','count','2025-03-05 18:00:04',90,NULL),(7,'UM2024','Push up','count','2025-03-05 18:38:01',60,NULL),(8,'UM2024','Squat','count','2025-03-05 19:06:42',60,NULL),(10,'UM2024','Sitted Knee up','count','2025-03-05 19:08:19',60,NULL),(11,'UM2024','Board breaking','score','2025-03-05 19:08:49',NULL,NULL),(12,'UM2024','Flexibility','score','2025-03-06 15:12:09',NULL,NULL),(13,'DJ1742123011686','Punching ','score','2025-03-17 02:30:55',NULL,NULL);
/*!40000 ALTER TABLE `test_template` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `testcondition`
--

DROP TABLE IF EXISTS `testcondition`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `testcondition` (
  `id` int NOT NULL AUTO_INCREMENT,
  `belt_rank` int DEFAULT NULL,
  `attendance_required` int NOT NULL,
  `dojang_code` varchar(255) DEFAULT NULL,
  `test_type` varchar(50) DEFAULT 'standard',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `testcondition`
--

LOCK TABLES `testcondition` WRITE;
/*!40000 ALTER TABLE `testcondition` DISABLE KEYS */;
INSERT INTO `testcondition` VALUES (14,1,1,'DJ1730305859821','Test1'),(15,2,2,'DJ1730305859821','Test1'),(16,3,3,'DJ1730305859821','Test1'),(17,4,4,'DJ1730305859821','Test2'),(18,6,60,'DJ1730305859821','Test2'),(26,1,20,'UM2024','Promotion'),(27,2,1,'UM2024','Promotion'),(28,3,1,'UM2024','Promotion'),(29,4,1,'UM2024','Promotion'),(30,5,1,'UM2024','Promotion'),(31,6,1,'UM2024','Promotion'),(32,7,16,'UM2024','Test'),(33,8,16,'UM2024','Test'),(34,9,16,'UM2024','Test'),(35,10,16,'UM2024','Test'),(36,11,16,'UM2024','Test'),(40,2,1,'DJ1742123011686','Test1'),(41,13,20,'UM2024','Test');
/*!40000 ALTER TABLE `testcondition` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `testlist`
--

DROP TABLE IF EXISTS `testlist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `testlist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `test_name` varchar(50) DEFAULT NULL,
  `test_time` varchar(20) DEFAULT NULL,
  `dojang_code` varchar(50) NOT NULL,
  `result` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `dojang_code` (`dojang_code`),
  CONSTRAINT `testlist_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `testlist_ibfk_2` FOREIGN KEY (`dojang_code`) REFERENCES `dojangs` (`dojang_code`)
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `testlist`
--

LOCK TABLES `testlist` WRITE;
/*!40000 ALTER TABLE `testlist` DISABLE KEYS */;
INSERT INTO `testlist` VALUES (68,101,'Test','5:40~6:20','UM2024',NULL,'2025-03-19 17:03:25','2025-03-19 17:03:25'),(72,112,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(73,113,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(74,114,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(75,115,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(76,116,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(77,117,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(78,118,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(79,119,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18'),(80,120,'Test','5:40~6:20','UM2024',NULL,'2025-03-23 18:13:18','2025-03-23 18:13:18');
/*!40000 ALTER TABLE `testlist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `testresult`
--

DROP TABLE IF EXISTS `testresult`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `testresult` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `test_template_id` int NOT NULL,
  `result_value` int NOT NULL,
  `dojang_code` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `test_template_id` (`test_template_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `testresult_ibfk_1` FOREIGN KEY (`test_template_id`) REFERENCES `test_template` (`id`),
  CONSTRAINT `testresult_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `testresult`
--

LOCK TABLES `testresult` WRITE;
/*!40000 ALTER TABLE `testresult` DISABLE KEYS */;
INSERT INTO `testresult` VALUES (34,70,1,10,'UM2024','2025-03-07 03:22:54'),(35,70,2,80,'UM2024','2025-03-07 03:22:54'),(36,70,3,70,'UM2024','2025-03-07 03:22:54'),(37,70,5,80,'UM2024','2025-03-07 03:22:54'),(38,70,6,70,'UM2024','2025-03-07 03:22:54'),(39,70,7,70,'UM2024','2025-03-07 03:22:54'),(40,70,8,70,'UM2024','2025-03-07 03:22:54'),(41,70,10,90,'UM2024','2025-03-07 03:22:54'),(42,70,11,90,'UM2024','2025-03-07 03:22:54'),(43,70,12,70,'UM2024','2025-03-07 03:22:54'),(54,102,1,18,'UM2024','2025-03-23 04:55:49'),(55,102,2,30,'UM2024','2025-03-23 04:55:49'),(56,102,3,68,'UM2024','2025-03-23 04:55:49'),(57,102,5,80,'UM2024','2025-03-23 04:55:49'),(58,102,6,68,'UM2024','2025-03-23 04:55:49'),(59,102,7,60,'UM2024','2025-03-23 04:55:49'),(60,102,8,90,'UM2024','2025-03-23 04:55:49'),(61,102,10,70,'UM2024','2025-03-23 04:55:49'),(62,102,11,10,'UM2024','2025-03-23 04:55:49'),(63,102,12,10,'UM2024','2025-03-23 04:55:49'),(64,70,1,10,'UM2024','2025-03-23 04:58:02'),(65,70,2,10,'UM2024','2025-03-23 04:58:02'),(66,70,3,10,'UM2024','2025-03-23 04:58:02'),(67,70,5,10,'UM2024','2025-03-23 04:58:02'),(68,70,6,60,'UM2024','2025-03-23 04:58:02'),(69,70,7,48,'UM2024','2025-03-23 04:58:02'),(70,70,8,45,'UM2024','2025-03-23 04:58:02'),(71,70,10,45,'UM2024','2025-03-23 04:58:02'),(72,70,11,10,'UM2024','2025-03-23 04:58:02'),(73,70,12,10,'UM2024','2025-03-23 04:58:02'),(74,116,6,65,'UM2024','2025-03-23 13:57:06'),(75,116,7,42,'UM2024','2025-03-23 13:57:06'),(76,116,8,55,'UM2024','2025-03-23 13:57:06'),(77,116,10,48,'UM2024','2025-03-23 13:57:06'),(78,117,6,78,'UM2024','2025-03-23 13:57:06'),(79,117,7,45,'UM2024','2025-03-23 13:57:06'),(80,117,8,60,'UM2024','2025-03-23 13:57:06'),(81,117,10,52,'UM2024','2025-03-23 13:57:06'),(82,118,6,62,'UM2024','2025-03-23 13:57:06'),(83,118,7,38,'UM2024','2025-03-23 13:57:06'),(84,118,8,50,'UM2024','2025-03-23 13:57:06'),(85,118,10,55,'UM2024','2025-03-23 13:57:06'),(86,119,6,45,'UM2024','2025-03-23 13:57:06'),(87,119,7,30,'UM2024','2025-03-23 13:57:06'),(88,119,8,40,'UM2024','2025-03-23 13:57:06'),(89,119,10,38,'UM2024','2025-03-23 13:57:06'),(90,120,6,72,'UM2024','2025-03-23 13:57:06'),(91,120,7,48,'UM2024','2025-03-23 13:57:06'),(92,120,8,65,'UM2024','2025-03-23 13:57:06'),(93,120,10,60,'UM2024','2025-03-23 13:57:06'),(94,121,6,70,'UM2024','2025-03-23 13:57:06'),(95,121,7,52,'UM2024','2025-03-23 13:57:06'),(96,121,8,58,'UM2024','2025-03-23 13:57:06'),(97,121,10,50,'UM2024','2025-03-23 13:57:06'),(98,122,6,58,'UM2024','2025-03-23 13:57:06'),(99,122,7,35,'UM2024','2025-03-23 13:57:06'),(100,122,8,45,'UM2024','2025-03-23 13:57:06'),(101,122,10,42,'UM2024','2025-03-23 13:57:06'),(102,123,6,68,'UM2024','2025-03-23 13:57:06'),(103,123,7,44,'UM2024','2025-03-23 13:57:06'),(104,123,8,56,'UM2024','2025-03-23 13:57:06'),(105,123,10,50,'UM2024','2025-03-23 13:57:06'),(106,124,6,82,'UM2024','2025-03-23 13:57:06'),(107,124,7,55,'UM2024','2025-03-23 13:57:06'),(108,124,8,68,'UM2024','2025-03-23 13:57:06'),(109,124,10,62,'UM2024','2025-03-23 13:57:06'),(110,125,6,75,'UM2024','2025-03-23 13:57:08'),(111,125,7,50,'UM2024','2025-03-23 13:57:08'),(112,125,8,62,'UM2024','2025-03-23 13:57:08'),(113,125,10,58,'UM2024','2025-03-23 13:57:08'),(114,126,6,72,'DJ1730305859821','2025-03-23 14:02:33'),(115,126,7,48,'DJ1730305859821','2025-03-23 14:02:33'),(116,126,8,60,'DJ1730305859821','2025-03-23 14:02:33'),(117,126,10,55,'DJ1730305859821','2025-03-23 14:02:33'),(118,127,6,65,'DJ1730305859821','2025-03-23 14:02:33'),(119,127,7,40,'DJ1730305859821','2025-03-23 14:02:33'),(120,127,8,52,'DJ1730305859821','2025-03-23 14:02:33'),(121,127,10,50,'DJ1730305859821','2025-03-23 14:02:33'),(122,128,6,80,'DJ1730305859821','2025-03-23 14:02:33'),(123,128,7,52,'DJ1730305859821','2025-03-23 14:02:33'),(124,128,8,65,'DJ1730305859821','2025-03-23 14:02:33'),(125,128,10,58,'DJ1730305859821','2025-03-23 14:02:33'),(126,129,6,55,'DJ1730305859821','2025-03-23 14:02:33'),(127,129,7,35,'DJ1730305859821','2025-03-23 14:02:33'),(128,129,8,45,'DJ1730305859821','2025-03-23 14:02:33'),(129,129,10,40,'DJ1730305859821','2025-03-23 14:02:33'),(130,130,6,68,'DJ1730305859821','2025-03-23 14:02:33'),(131,130,7,45,'DJ1730305859821','2025-03-23 14:02:33'),(132,130,8,58,'DJ1730305859821','2025-03-23 14:02:33'),(133,130,10,53,'DJ1730305859821','2025-03-23 14:02:34'),(134,70,1,12,'UM2024','2025-03-23 14:00:00'),(135,70,2,50,'UM2024','2025-03-23 14:00:00'),(136,70,1,14,'UM2024','2025-03-24 15:00:00'),(137,70,2,55,'UM2024','2025-03-24 15:00:00'),(138,70,1,16,'UM2024','2025-03-25 16:00:00'),(139,70,2,60,'UM2024','2025-03-25 16:00:00'),(140,70,1,18,'UM2024','2025-04-25 14:00:00'),(141,70,2,63,'UM2024','2025-04-25 14:00:00'),(142,70,1,20,'UM2024','2025-04-26 15:00:00'),(143,70,2,70,'UM2024','2025-04-26 15:00:00'),(144,70,1,22,'UM2024','2025-04-27 16:00:00'),(145,70,2,75,'UM2024','2025-04-27 16:00:00');
/*!40000 ALTER TABLE `testresult` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('owner','admin','student') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `owner_code` varchar(50) DEFAULT NULL,
  `dojang_code` varchar(50) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `saved_card_id` varchar(255) DEFAULT NULL,
  `privacy_policy_agreed` tinyint(1) DEFAULT '0',
  `privacy_policy_agreed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'saehan.jh@gmail.com','$2b$10$VAwfNb0ZneK3rcSNVInbR.EFPXy7ngXTFfUPYNpe5Xo6sNbgG.x/S','owner','2025-03-21 19:00:00','Jaehyun','Um',NULL,NULL,'191904','UM2024',NULL,NULL,0,NULL),(4,'jcworldtkd.jh@gmail.com','$2b$10$uHs62YMEByyTiJhBO2NmzOBQs7MiPSvhJgmZaPxuA3PbCiM7X1LLu','owner','2024-10-30 16:30:59','m','m',NULL,NULL,'20241030','DJ1730305859821',NULL,NULL,0,NULL),(5,'jaehyunum7@gmail.com','$2b$10$OAJ206IGvU2Z3y/OW9O6ourDI7TUOGpo9q9MfU0rWAtjOxuD8OnT2','owner','2025-03-16 11:03:31','J','U',NULL,NULL,'595878','DJ1742123011686',NULL,NULL,0,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-03-25 12:54:07

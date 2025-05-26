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
  `stripe_access_token` varchar(255) DEFAULT NULL,
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
  `fee_type` enum('program_fee','registration_fee') DEFAULT 'program_fee',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=152 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `program_payments`
--

LOCK TABLES `program_payments` WRITE;
/*!40000 ALTER TABLE `program_payments` DISABLE KEYS */;
INSERT INTO `program_payments` VALUES (142,'6a5c8758-fc5c-11ef-80e2-c25563f29511','test-source-1',52,50.00,'2025-03-08 17:00:00','completed','UM2024','6a5c8c1c-fc5c-11ef-80e2-c25563f29511',2,68,'program_fee'),(144,'6a5d4f30-fc5c-11ef-80e2-c25563f29511','test-source-3',52,100.00,'2025-03-08 20:00:00','completed','UM2024','6a5d4f58-fc5c-11ef-80e2-c25563f29511',2,70,'program_fee'),(145,'38a3fa9c-fc5d-11ef-80e2-c25563f29511','test-source-68',52,120.00,'2025-03-08 17:00:00','completed','UM2024','38a3fe0c-fc5d-11ef-80e2-c25563f29511',2,68,'program_fee'),(147,'38a444de-fc5d-11ef-80e2-c25563f29511','test-source-70',52,140.00,'2025-03-08 20:00:00','completed','UM2024','38a44524-fc5d-11ef-80e2-c25563f29511',2,70,'program_fee');
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
  `stripe_access_token` varchar(255) DEFAULT NULL,
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
INSERT INTO `parents` VALUES (2,'vstaekwondo.um@gmail.com','$2b$10$2micGfaQtWfODseVieyiKuxtusD3owfNl/qrovgyrIUcgjF1Q9Ccy','parent','2024-10-11 09:14:49','Jaehyun','Um','1991-03-15','male','4046901615','A4S1BF9XYK900XRRRJHKGM585W','UM2024'),(3,'jctkd.jh@gmail.com','$2b$10$s0MeRoCWthI4mwcBYhLB/em6EgjHXQ2VupU9HGT0UnjPyBUaNuB12','parent','2024-10-31 03:49:31','k','k','1991-03-08','male','4046901615','3P9FH5VFGWTTX82C2CH3V4R0FC','DJ1730305859821'),(5,'jaehyunum7@gmail.com','$2b$10$OAJ206IGvU2Z3y/OW9O6ourDI7TUOGpo9q9MfU0rWAtjOxuD8OnT2','parent','2025-03-16 11:03:31','J','U',NULL,NULL,'595878','DJ1742123011686',NULL,NULL,0,NULL);
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
  `fee_type` enum('program_fee','registration_fee') DEFAULT 'program_fee',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=152 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `program_payments`
--

LOCK TABLES `program_payments` WRITE;
/*!40000 ALTER TABLE `program_payments` DISABLE KEYS */;
INSERT INTO `program_payments` VALUES (142,'6a5c8758-fc5c-11ef-80e2-c25563f29511','test-source-1',52,50.00,'2025-03-08 17:00:00','completed','UM2024','6a5c8c1c-fc5c-11ef-80e2-c25563f29511',2,68,'program_fee'),(144,'6a5d4f30-fc5c-11ef-80e2-c25563f29511','test-source-3',52,100.00,'2025-03-08 20:00:00','completed','UM2024','6a5d4f58-fc5c-11ef-80e2-c25563f29511',2,70,'program_fee'),(145,'38a3fa9c-fc5d-11ef-80e2-c25563f29511','test-source-68',52,120.00,'2025-03-08 17:00:00','completed','UM2024','38a3fe0c-fc5d-11ef-80e2-c25563f29511',2,68,'program_fee'),(147,'38a444de-fc5d-11ef-80e2-c25563f29511','test-source-70',52,140.00,'2025-03-08 20:00:00','completed','UM2024','38a44524-fc5d-11ef-80e2-c25563f29511',2,70,'program_fee');
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
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-03-25 12:54:07

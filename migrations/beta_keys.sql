-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Mar 12, 2026 at 03:21 PM
-- Server version: 8.0.42
-- PHP Version: 8.4.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `plus`
--

-- --------------------------------------------------------

--
-- Table structure for table `beta_keys`
--

CREATE TABLE `beta_keys` (
  `id` int NOT NULL,
  `code` varchar(64) NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `used_by` int DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `beta_keys`
--

INSERT INTO `beta_keys` (`id`, `code`, `used`, `used_by`, `used_at`, `created_at`) VALUES
(1, 'test', 1, 5, '2026-02-26 12:06:07', '2026-02-26 17:04:45'),
(2, 'TEST2', 0, NULL, NULL, '2026-02-26 17:41:56'),
(3, 'HELLOWORLD', 0, NULL, NULL, '2026-02-27 12:54:37'),
(4, 'HIII', 0, NULL, NULL, '2026-02-27 16:13:51');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `beta_keys`
--
ALTER TABLE `beta_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `beta_keys`
--
ALTER TABLE `beta_keys`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

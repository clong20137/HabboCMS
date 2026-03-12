-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Mar 12, 2026 at 04:52 PM
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
-- Table structure for table `hk_audit_log`
--

CREATE TABLE `hk_audit_log` (
  `id` int NOT NULL,
  `actor_id` int NOT NULL,
  `actor_name` varchar(64) NOT NULL,
  `actor_rank` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `target_type` varchar(32) DEFAULT NULL,
  `target_id` varchar(64) DEFAULT NULL,
  `details_json` json DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `hk_audit_log`
--

INSERT INTO `hk_audit_log` (`id`, `actor_id`, `actor_name`, `actor_rank`, `action`, `target_type`, `target_id`, `details_json`, `ip`, `created_at`) VALUES
(1, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', '0', '{\"word\": \"test\", \"strict\": true, \"replacement\": \"test\"}', '::1', '2026-02-25 16:14:24'),
(2, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'shit', '{\"word\": \"shit\", \"strict\": true, \"bannable\": false, \"replacement\": \"****\"}', '::1', '2026-02-25 16:26:38'),
(3, 1, 'Caleb', 7, 'wordfilter.delete', 'wordfilter', 'shit', NULL, '::1', '2026-02-25 16:27:19'),
(4, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'fuck', '{\"word\": \"fuck\", \"strict\": true, \"bannable\": false, \"replacement\": \"****\"}', '::1', '2026-02-25 17:21:55'),
(5, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'fag', '{\"word\": \"fag\", \"strict\": true, \"bannable\": false, \"replacement\": \"***\"}', '::1', '2026-02-25 17:29:57'),
(6, 1, 'Caleb', 7, 'wordfilter.delete', 'wordfilter', 'fag', NULL, '::1', '2026-02-25 17:38:44'),
(7, 1, 'Caleb', 7, 'wordfilter.delete', 'wordfilter', 'fuck', NULL, '::1', '2026-02-25 17:38:47'),
(8, 1, 'Caleb', 7, 'wordfilter.delete', 'wordfilter', 'test', NULL, '::1', '2026-02-25 17:38:49'),
(9, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'fag', '{\"word\": \"fag\", \"strict\": false, \"bannable\": true, \"replacement\": \"***\"}', '::1', '2026-02-25 17:38:58'),
(10, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'anubis', '{\"word\": \"anubis\", \"strict\": true, \"bannable\": false, \"replacement\": \"******\"}', '::1', '2026-02-25 17:39:03'),
(11, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'AnubisRP', '{\"word\": \"AnubisRP\", \"strict\": true, \"bannable\": false, \"replacement\": \"********\"}', '::1', '2026-02-25 17:40:13'),
(12, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'anoobis', '{\"word\": \"anoobis\", \"strict\": true, \"bannable\": false, \"replacement\": \"*******\"}', '::1', '2026-02-25 17:40:28'),
(13, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'cunt', '{\"word\": \"cunt\", \"strict\": false, \"bannable\": false, \"replacement\": \"****\"}', '::1', '2026-02-25 17:46:10'),
(14, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'caleb', '{\"word\": \"caleb\", \"strict\": true, \"bannable\": false, \"replacement\": \"*****\"}', '::1', '2026-02-25 17:54:14'),
(15, 1, 'Caleb', 7, 'wordfilter.delete', 'wordfilter', 'caleb', NULL, '::1', '2026-02-25 18:01:52'),
(16, 1, 'Caleb', 7, 'wordfilter.create', 'wordfilter', 'queer', '{\"word\": \"queer\", \"strict\": true, \"bannable\": false, \"replacement\": \"*****\"}', '::1', '2026-02-25 19:00:12'),
(17, 1, 'Caleb', 7, 'news.delete', 'news', '2', NULL, '::1', '2026-02-25 19:30:49'),
(18, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-26 12:48:15'),
(19, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-26 12:48:19'),
(20, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-26 13:25:13'),
(21, 1, 'Caleb', 7, 'tickets.reply', 'support_ticket', '1', '{\"status\": \"closed\"}', '::1', '2026-02-26 14:44:10'),
(22, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-26 15:00:06'),
(23, 1, 'Caleb', 7, 'tickets.status', 'support_ticket', '1', '{\"by\": \"Caleb\", \"status\": \"open\"}', '::1', '2026-02-26 15:00:22'),
(24, 1, 'Caleb', 7, 'tickets.reply', 'support_ticket', '1', '{\"status\": null}', '::1', '2026-02-26 15:00:27'),
(25, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-26 15:51:31'),
(26, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:22:19'),
(27, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:22:20'),
(28, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:22:21'),
(29, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:22:22'),
(30, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:22:23'),
(31, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:22:23'),
(32, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:22:24'),
(33, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:22:24'),
(34, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:22:26'),
(35, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:22:49'),
(36, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:26:51'),
(37, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:26:51'),
(38, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:26:52'),
(39, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:26:53'),
(40, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:26:57'),
(41, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:26:58'),
(42, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:26:59'),
(43, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:27:00'),
(44, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:27:01'),
(45, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:27:03'),
(46, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:27:03'),
(47, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:27:05'),
(48, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:27:06'),
(49, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:27:07'),
(50, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:27:07'),
(51, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:28:01'),
(52, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:28:03'),
(53, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:28:04'),
(54, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:28:07'),
(55, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:28:08'),
(56, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:28:40'),
(57, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:28:40'),
(58, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:28:42'),
(59, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:28:43'),
(60, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:28:44'),
(61, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:29:14'),
(62, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:29:14'),
(63, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:29:16'),
(64, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:29:57'),
(65, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:29:57'),
(66, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:29:58'),
(67, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:29:59'),
(68, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:30:42'),
(69, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:30:43'),
(70, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:30:43'),
(71, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:30:44'),
(72, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:31:25'),
(73, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:31:25'),
(74, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:31:42'),
(75, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:31:43'),
(76, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:31:44'),
(77, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:31:45'),
(78, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:31:49'),
(79, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:31:50'),
(80, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:32:16'),
(81, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:32:17'),
(82, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:32:18'),
(83, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:32:19'),
(84, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:33:37'),
(85, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:33:37'),
(86, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:39:20'),
(87, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:39:23'),
(88, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:39:23'),
(89, 1, 'Caleb', 7, 'beta_keys.create', 'beta_key', 'TEST2', '{\"code\": \"TEST2\"}', '::1', '2026-02-26 17:41:56'),
(90, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:42:28'),
(91, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:42:29'),
(92, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:43:17'),
(93, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:43:17'),
(94, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:52:17'),
(95, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:52:18'),
(96, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:52:19'),
(97, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:52:19'),
(98, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:52:25'),
(99, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:52:26'),
(100, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:54:51'),
(101, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:54:52'),
(102, 1, 'Caleb', 7, 'tickets.status', 'support_ticket', '3', '{\"by\": \"Caleb\", \"status\": \"closed\"}', '::1', '2026-02-26 17:55:53'),
(103, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusCMS\"}', '::1', '2026-02-26 17:58:30'),
(104, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 17:59:47'),
(105, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 17:59:47'),
(106, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PrimeRP\"}', '::1', '2026-02-26 18:13:30'),
(107, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP\"}', '::1', '2026-02-26 18:23:45'),
(108, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP\"}', '::1', '2026-02-26 18:24:21'),
(109, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP2\"}', '::1', '2026-02-26 18:24:25'),
(110, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP2\"}', '::1', '2026-02-26 18:24:25'),
(111, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP2\"}', '::1', '2026-02-26 18:24:27'),
(112, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP2\"}', '::1', '2026-02-26 18:24:27'),
(113, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP2\"}', '::1', '2026-02-26 18:24:27'),
(114, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP\"}', '::1', '2026-02-26 18:24:33'),
(115, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusRP2\"}', '::1', '2026-02-26 18:28:18'),
(116, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'hotel_name', '{\"value\": \"PlusCMS\"}', '::1', '2026-02-26 18:28:55'),
(117, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 18:30:03'),
(118, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 18:30:03'),
(119, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 20:43:55'),
(120, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 20:43:55'),
(121, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-26 20:43:56'),
(122, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-26 20:43:56'),
(123, 1, 'Caleb', 7, 'tickets.reply', 'support_ticket', '4', '{\"status\": \"closed\"}', '::1', '2026-02-27 12:49:45'),
(124, 1, 'Caleb', 7, 'tickets.reply', 'support_ticket', '2', '{\"status\": \"closed\"}', '::1', '2026-02-27 12:49:56'),
(125, 1, 'Caleb', 7, 'tickets.reply', 'support_ticket', '1', '{\"status\": \"closed\"}', '::1', '2026-02-27 12:50:03'),
(126, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 12:54:32'),
(127, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 12:54:32'),
(128, 1, 'Caleb', 7, 'beta_keys.create', 'beta_key', 'HELLOWORLD', '{\"code\": \"HELLOWORLD\"}', '::1', '2026-02-27 12:54:37'),
(129, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 16:13:45'),
(130, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 16:13:46'),
(131, 1, 'Caleb', 7, 'beta_keys.create', 'beta_key', 'HIII', '{\"code\": \"HIII\"}', '::1', '2026-02-27 16:13:51'),
(132, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 17:03:45'),
(133, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 17:03:45'),
(134, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 17:08:14'),
(135, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 17:08:15'),
(136, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 17:08:52'),
(137, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 17:08:55'),
(138, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 17:09:08'),
(139, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 17:09:08'),
(140, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 17:10:51'),
(141, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 17:10:51'),
(142, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-02-27 17:28:08'),
(143, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-02-27 17:28:10'),
(144, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-27 17:28:40'),
(145, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-27 17:28:41'),
(146, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-27 17:28:41'),
(147, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-27 17:28:41'),
(148, 1, 'Caleb', 7, 'news.update', 'news', '1', '{\"title\": \"Welcome to PlusCMS!\", \"imageUrl\": \"lpromo_dailyachi_sep25.png\"}', '::1', '2026-02-27 17:28:42'),
(149, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-03-03 15:48:51'),
(150, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-03-03 15:48:51'),
(151, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"1\"}', '::1', '2026-03-03 15:48:52'),
(152, 1, 'Caleb', 7, 'settings.update', 'cms_setting', 'beta_mode_enabled', '{\"value\": \"0\"}', '::1', '2026-03-03 15:48:52'),
(153, 1, 'Caleb', 7, 'bans.create', 'ban', '2', '{\"value\": \"Caleb\", \"expire\": 1772747091, \"bantype\": \"user\", \"permanent\": false}', '::1', '2026-03-05 20:44:51'),
(154, 1, 'Caleb', 7, 'bans.delete', 'ban', '2', '{\"by\": \"Caleb\"}', '::1', '2026-03-06 13:22:15');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `hk_audit_log`
--
ALTER TABLE `hk_audit_log`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `hk_audit_log`
--
ALTER TABLE `hk_audit_log`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=155;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

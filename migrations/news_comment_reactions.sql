-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Mar 12, 2026 at 03:25 PM
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
-- Table structure for table `news_comment_reactions`
--

CREATE TABLE `news_comment_reactions` (
  `id` int NOT NULL,
  `comment_id` int NOT NULL,
  `user_id` int NOT NULL,
  `reaction` varchar(32) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `news_comment_reactions`
--

INSERT INTO `news_comment_reactions` (`id`, `comment_id`, `user_id`, `reaction`, `created_at`) VALUES
(7, 2, 1, 'thumbs_up', '2026-02-25 12:30:30'),
(8, 1, 1, 'thumbs_up', '2026-02-25 12:30:30'),
(11, 3, 1, 'thumbs_up', '2026-02-25 12:51:19'),
(12, 4, 1, 'thumbs_up', '2026-02-26 13:25:29'),
(13, 4, 1, 'smile', '2026-02-26 13:25:30'),
(14, 6, 1, 'smile', '2026-03-04 14:56:45'),
(15, 5, 1, 'smile', '2026-03-04 14:56:46');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `news_comment_reactions`
--
ALTER TABLE `news_comment_reactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_reaction` (`comment_id`,`user_id`,`reaction`),
  ADD KEY `idx_comment` (`comment_id`),
  ADD KEY `idx_user` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `news_comment_reactions`
--
ALTER TABLE `news_comment_reactions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

<?php

header('Content-Type: application/json');
$json = file_get_contents('php://input');
$configFile = __DIR__ . '/../data/config.json';
file_put_contents($configFile, $json);

?>
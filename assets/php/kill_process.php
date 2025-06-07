<?php
header('Content-Type: text/plain');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pid = isset($_POST['pid']) ? (int)$_POST['pid'] : 0;
    
    if ($pid <= 0) {
        die("Invalid PID");
    }
    // Sanitize the PID and execute kill command
    $pid = escapeshellarg($pid);
    $output = shell_exec("kill -9 $pid 2>&1");
    
    if ($output === null) {
        echo "Process $pid killed successfully";
    } else {
        echo "Failed to kill process $pid: $output";
    }
} else {
    echo "Invalid request method";
}
?>
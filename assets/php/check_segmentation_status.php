<?php
// assets/php/check_segmentation_status.php
// Check the status of background segmentation

// Disable error output to prevent HTML from corrupting JSON
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');

$transcript_dir = __DIR__ . '/../data/transcripts';
$output_path = $transcript_dir . '/segmentedtext.txt';
$status_file = $transcript_dir . '/segmentation_status.json';
$pid_file = $transcript_dir . '/segmentation.pid';
$log_file = $transcript_dir . '/segmentation.log';

$response = [
    'success' => true,
    'completed' => false,
    'running' => false,
    'output_exists' => false,
    'output_content' => null
];

// Check if output file exists and has content
if (file_exists($output_path)) {
    $output_size = filesize($output_path);
    if ($output_size > 0) {
        $content = file_get_contents($output_path);
        if (!empty(trim($content))) {
            $response['completed'] = true;
            $response['output_exists'] = true;
            $response['output_size'] = $output_size;
            $response['output_content'] = $content;
            
            // Clean up status file
            if (file_exists($status_file)) {
                @unlink($status_file);
            }
            if (file_exists($pid_file)) {
                @unlink($pid_file);
            }
            
            echo json_encode($response);
            exit;
        }
    }
}

// Check status file
if (file_exists($status_file)) {
    $status = json_decode(file_get_contents($status_file), true);
    if ($status) {
        if (isset($status['error']) && $status['error']) {
            $response['error'] = $status['error'];
            echo json_encode($response);
            exit;
        }
        
        if ($status['running'] === true) {
            $response['running'] = true;
            $response['start_time'] = $status['start_time'] ?? null;
            $response['pid'] = $status['pid'] ?? null;
            
            // Check if process is still alive - FIXED: null-safe pid handling
            if (!empty($response['pid'])) {
                $pid = (string)$response['pid'];  // Convert to string to avoid null issues
                $running = shell_exec("ps -p " . escapeshellarg($pid) . " > /dev/null 2>&1 && echo 'running'");
                if (trim($running) !== 'running') {
                    // Process died but status says running - error
                    $response['running'] = false;
                    $response['error'] = 'Process died unexpectedly';
                    
                    // Read log for error
                    if (file_exists($log_file)) {
                        $log_content = file_get_contents($log_file);
                        $response['log_tail'] = substr($log_content, -500);
                    }
                }
            } else {
                // No PID but status says running - likely stale state
                $response['running'] = false;
                $response['error'] = 'Segmentation process has no PID';
            }
            
            echo json_encode($response);
            exit;
        }
    }
}

// No status file and no output - not running
$response['message'] = 'No segmentation process running';
echo json_encode($response);
?>
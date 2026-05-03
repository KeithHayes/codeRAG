<?php
// assets/php/check_diarization_status.php
// Check the status of background diarization

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);

$transcript_dir = __DIR__ . '/../data/transcripts';
$output_path = $transcript_dir . '/diarizatedtext.txt';
$status_file = $transcript_dir . '/diarization_status.json';
$pid_file = $transcript_dir . '/diarization.pid';
$log_file = $transcript_dir . '/diarization.log';

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
            
            // Check if process is still alive
            if ($response['pid']) {
                $running = shell_exec("ps -p " . escapeshellarg($response['pid']) . " > /dev/null 2>&1 && echo 'running'");
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
            }
            
            echo json_encode($response);
            exit;
        }
    }
}

// No status file and no output - not running
$response['message'] = 'No diarization process running';
echo json_encode($response);
?>
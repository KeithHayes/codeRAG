<?php
header('Content-Type: application/json');

// Configuration
$pythonPath = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python3';
$scriptPath = '/var/www/html/doomsteadRAG/assets/py/load_server.py';
$webuiDir   = '/home/kdog/text-generation-webui';
$logPath    = '/var/www/html/doomsteadRAG/assets/logs';
$logFile    = $logPath . '/doomstead_server.log';

function is_server_running() {
    $output = shell_exec("pgrep -f 'python.*server.py'");
    return !empty($output);
}

try {
    // Check if server is already running
    /*if (is_server_running()) {
        echo json_encode([
            'success' => false,
            'error'   => 'Server is already running'
        ]);
        exit;
    }*/

    // Verify critical paths
    if (!file_exists($pythonPath)) {
        throw new Exception("Python interpreter missing at {$pythonPath}");
    }
    if (!file_exists($scriptPath)) {
        throw new Exception("Launch script missing at {$scriptPath}");
    }
    if (!file_exists($webuiDir)) {
        throw new Exception("WebUI directory missing at {$webuiDir}");
    }
    if (!is_dir($logPath) || !is_writable($logPath)) {
        throw new Exception("Log path is not writable or doesn't exist: {$logPath}");
    }

    // Build the launch command with proper environment context
    $command = sprintf(
        'cd %s && ' .
        'export PATH=%s:$PATH && ' .
        'export VIRTUAL_ENV=%s && ' .
        'nohup %s %s > %s 2>&1 & echo $!',
        escapeshellarg($webuiDir),
        escapeshellarg('/home/kdog/text-generation-webui/venv/bin'),
        escapeshellarg('/home/kdog/text-generation-webui/venv'),
        escapeshellcmd($pythonPath),
        escapeshellarg($scriptPath),
        escapeshellarg($logFile)
    );

    // Execute with full environment context
    $output = shell_exec($command);
    $pid = trim($output);

    if (empty($pid) || !is_numeric($pid)) {
        throw new Exception("Failed to launch process. Output: " . var_export($output, true));
    }

    // Verify process is running
    sleep(2); // Give it time to start
    $isRunning = shell_exec("ps -p $pid -o pid=");

    if (empty($isRunning)) {
        throw new Exception("Process started but died immediately (PID: $pid). Check logs: $logFile");
    }

    echo json_encode([
        'success'   => true,
        'pid'       => $pid,
        'message'   => 'Server launch initiated',
        'log_file'  => $logFile
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success'    => false,
        'error'      => $e->getMessage(),
        'debug_info' => [
            'current_user' => trim(shell_exec('whoami')),
            'web_user'     => trim(shell_exec('ps -o user= -p ' . getmypid())),
            'env_path'     => shell_exec('echo $PATH'),
            'venv_status'  => file_exists('/home/kdog/text-generation-webui/venv/bin/activate') ? 'exists' : 'missing'
        ]
    ]);
}
?>

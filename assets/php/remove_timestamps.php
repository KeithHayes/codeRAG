<?php
// assets/php/remove_timestamps.php
header('Content-Type: application/json');

function is_timestamp_line($line) {
    $trimmed = trim($line);
    if ($trimmed === '') {
        return true; // skip empty lines
    }

    // Patterns that match timestamp lines only (no actual spoken words)
    $patterns = [
        '/^\d+:\d+$/',                       // "0:13"
        '/^\d+:\d{2}$/',                     // "0:13" (alternative)
        '/^\d+\s+seconds?$/',                // "13 seconds" or "1 second"
        '/^\d+\s+minutes?$/',                // "5 minutes"
        '/^\d+\s+minutes?,\s+\d+\s+seconds?$/', // "1 minute, 1 second"
        '/^\d+\s+minutes?\s+and\s+\d+\s+seconds?$/', // "1 minute and 1 second"
        '/^\d+:\d{2}:\d{2}$/',               // "1:01:23" (if present)
        '/^\d+$/',                           // standalone number up to 3 digits (e.g., "13")
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $trimmed)) {
            return true;
        }
    }
    return false;
}

function remove_timestamps($input_file, $output_file) {
    // Check input file
    if (!file_exists($input_file)) {
        return ['success' => false, 'output' => "Input file not found: $input_file"];
    }
    $content = file_get_contents($input_file);
    if ($content === false) {
        return ['success' => false, 'output' => "Failed to read input file: $input_file"];
    }
    if (trim($content) === '') {
        return ['success' => false, 'output' => 'Raw transcript is empty. Please paste a valid transcript first.'];
    }

    $lines = explode("\n", $content);
    $cleaned_lines = [];

    foreach ($lines as $line) {
        if (!is_timestamp_line($line)) {
            $cleaned_lines[] = $line;
        }
    }

    $cleaned_content = implode("\n", $cleaned_lines);
    // Remove excessive blank lines
    $cleaned_content = preg_replace('/\n{3,}/', "\n\n", $cleaned_content);
    $cleaned_content = trim($cleaned_content);

    if ($cleaned_content === '') {
        return [
            'success' => false,
            'output' => 'Timestamp removal resulted in empty content. Check that the transcript contains spoken words, not just timestamps.'
        ];
    }

    // Write output file
    $result = file_put_contents($output_file, $cleaned_content);
    if ($result === false) {
        return ['success' => false, 'output' => "Failed to write output file: $output_file"];
    }

    return [
        'success' => true,
        'output' => 'Timestamps removed successfully',
        'original_size' => strlen($content),
        'cleaned_size' => strlen($cleaned_content)
    ];
}

$transcript_dir = __DIR__ . '/../data/transcripts';
$input_file = $transcript_dir . '/rawtranscript.txt';
$output_file = $transcript_dir . '/sanstimestamps.txt';

// Ensure the transcripts directory exists
if (!is_dir($transcript_dir)) {
    if (!mkdir($transcript_dir, 0755, true)) {
        echo json_encode(['success' => false, 'output' => 'Failed to create transcripts directory']);
        exit;
    }
}

$result = remove_timestamps($input_file, $output_file);
echo json_encode($result);
exit;
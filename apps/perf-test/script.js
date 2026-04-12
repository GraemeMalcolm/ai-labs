// Performance test configuration
const ITERATIONS = 500;
const TEST_RUNS = 3;

// Run performance test when page loads
window.addEventListener('DOMContentLoaded', runPerformanceTest);

function runPerformanceTest() {
    const resultsDiv = document.getElementById('results');
    const times = [];

    // Run the test multiple times
    for (let run = 0; run < TEST_RUNS; run++) {
        const startTime = performance.now();

        // Simple loop to test performance
        for (let i = 0; i < ITERATIONS; i++) {
            // Perform some basic calculations
            let temp = Math.sqrt(i) * Math.random();
            temp = temp + i / 2;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        times.push(duration);
    }

    // Calculate average
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;

    // Display results
    displayResults(times, average);
}

function displayResults(times, average) {
    const resultsDiv = document.getElementById('results');

    let html = '<h2>Test Results</h2>';

    times.forEach((time, index) => {
        html += `<div class="result-item">Run ${index + 1}: ${time.toFixed(2)} ms</div>`;
    });

    html += `<div class="average">Average: ${average.toFixed(2)} ms</div>`;

    resultsDiv.innerHTML = html;
}

#!/bin/bash

# Voypath Test Automation Script
# Implements TODO-088: Place API テスト自動化 - Automation Setup
# Usage: ./scripts/run-tests.sh [unit|integration|performance|all|ci]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="$PROJECT_DIR/tests/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

print_header() {
    echo -e "${BLUE}🧪 Voypath Test Automation${NC}"
    echo -e "${BLUE}================================${NC}"
    echo "Project: $PROJECT_DIR"
    echo "Results: $RESULTS_DIR"
    echo "Timestamp: $TIMESTAMP"
    echo ""
}

print_section() {
    echo -e "${YELLOW}$1${NC}"
    echo "$(echo "$1" | sed 's/./=/g')"
}

run_unit_tests() {
    print_section "🔬 Running Unit Tests"
    cd "$PROJECT_DIR"
    
    echo "Running Place API unit tests..."
    npm run test:unit -- --reporter=verbose --reporter=json --outputFile="$RESULTS_DIR/unit-tests-$TIMESTAMP.json"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Unit tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ Unit tests failed${NC}"
        return 1
    fi
}

run_integration_tests() {
    print_section "🔗 Running Integration Tests"
    cd "$PROJECT_DIR"
    
    echo "Running Place API integration tests..."
    npm run test:integration -- --reporter=verbose --reporter=json --outputFile="$RESULTS_DIR/integration-tests-$TIMESTAMP.json"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Integration tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ Integration tests failed${NC}"
        return 1
    fi
}

run_performance_tests() {
    print_section "⚡ Running Performance Tests"
    cd "$PROJECT_DIR"
    
    echo "Running Place API performance tests..."
    echo "This may take several minutes..."
    
    # Set performance test environment variables
    export PERFORMANCE_TEST_ITERATIONS=${PERFORMANCE_TEST_ITERATIONS:-20}
    export PERFORMANCE_THRESHOLD_MS=${PERFORMANCE_THRESHOLD_MS:-500}
    
    npm run test:performance -- --reporter=verbose --reporter=json --outputFile="$RESULTS_DIR/performance-tests-$TIMESTAMP.json"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Performance tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ Performance tests failed${NC}"
        return 1
    fi
}

run_coverage() {
    print_section "📊 Generating Code Coverage"
    cd "$PROJECT_DIR"
    
    echo "Generating comprehensive coverage report..."
    npm run test:coverage -- --reporter=json --outputFile="$RESULTS_DIR/coverage-$TIMESTAMP.json"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Coverage report generated${NC}"
        echo "Coverage report available in: $PROJECT_DIR/coverage/"
        return 0
    else
        echo -e "${RED}❌ Coverage generation failed${NC}"
        return 1
    fi
}

check_quality_gates() {
    print_section "🚪 Checking Quality Gates"
    
    local unit_result=$1
    local integration_result=$2
    local coverage_result=$3
    
    local passed=0
    local total=3
    
    echo "Quality Gate Results:"
    echo "===================="
    
    if [ $unit_result -eq 0 ]; then
        echo -e "Unit Tests: ${GREEN}✅ PASS${NC}"
        ((passed++))
    else
        echo -e "Unit Tests: ${RED}❌ FAIL${NC}"
    fi
    
    if [ $integration_result -eq 0 ]; then
        echo -e "Integration Tests: ${GREEN}✅ PASS${NC}"
        ((passed++))
    else
        echo -e "Integration Tests: ${RED}❌ FAIL${NC}"
    fi
    
    if [ $coverage_result -eq 0 ]; then
        echo -e "Code Coverage: ${GREEN}✅ PASS${NC}"
        ((passed++))
    else
        echo -e "Code Coverage: ${RED}❌ FAIL${NC}"
    fi
    
    echo ""
    echo "Overall Result: $passed/$total quality gates passed"
    
    if [ $passed -eq $total ]; then
        echo -e "${GREEN}🎉 All quality gates passed!${NC}"
        return 0
    else
        echo -e "${RED}🚨 Quality gates failed!${NC}"
        return 1
    fi
}

generate_summary_report() {
    print_section "📋 Generating Summary Report"
    
    local summary_file="$RESULTS_DIR/test-summary-$TIMESTAMP.json"
    local html_file="$RESULTS_DIR/test-summary-$TIMESTAMP.html"
    
    # Create JSON summary
    cat > "$summary_file" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "${NODE_ENV:-development}",
    "project": "voypath-place-api",
    "test_run_id": "$TIMESTAMP",
    "results": {
        "unit_tests": $1,
        "integration_tests": $2,
        "performance_tests": $3,
        "coverage": $4
    },
    "quality_gates_passed": $5,
    "artifacts": {
        "results_directory": "$RESULTS_DIR",
        "coverage_report": "$PROJECT_DIR/coverage/index.html"
    }
}
EOF

    # Create HTML summary
    cat > "$html_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Voypath Test Summary - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .status { display: inline-block; padding: 8px 16px; border-radius: 20px; margin: 5px; font-weight: bold; }
        .pass { background: #d4edda; color: #155724; }
        .fail { background: #f8d7da; color: #721c24; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #667eea; background: #f8f9fa; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Voypath Test Results</h1>
            <p class="timestamp">Generated: $(date)</p>
        </div>
        
        <div class="section">
            <h2>📊 Test Results</h2>
            <div class="status $([ $1 -eq 0 ] && echo 'pass' || echo 'fail')">
                Unit Tests: $([ $1 -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')
            </div>
            <div class="status $([ $2 -eq 0 ] && echo 'pass' || echo 'fail')">
                Integration Tests: $([ $2 -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')
            </div>
            <div class="status $([ $3 -eq 0 ] && echo 'pass' || echo 'fail')">
                Performance Tests: $([ $3 -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')
            </div>
            <div class="status $([ $4 -eq 0 ] && echo 'pass' || echo 'fail')">
                Code Coverage: $([ $4 -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')
            </div>
        </div>
        
        <div class="section">
            <h2>🚪 Quality Gates</h2>
            <div class="status $([ $5 -eq 0 ] && echo 'pass' || echo 'fail')">
                Overall Status: $([ $5 -eq 0 ] && echo '🎉 ALL PASSED' || echo '🚨 FAILED')
            </div>
        </div>
        
        <div class="section">
            <h2>📁 Artifacts</h2>
            <ul>
                <li>Results Directory: <code>$RESULTS_DIR</code></li>
                <li>Coverage Report: <code>$PROJECT_DIR/coverage/index.html</code></li>
                <li>Test Summary: <code>$summary_file</code></li>
            </ul>
        </div>
    </div>
</body>
</html>
EOF

    echo -e "${GREEN}📋 Summary report generated:${NC}"
    echo "  JSON: $summary_file"
    echo "  HTML: $html_file"
}

show_usage() {
    echo "Usage: $0 [unit|integration|performance|all|ci]"
    echo ""
    echo "Commands:"
    echo "  unit         Run unit tests only"
    echo "  integration  Run integration tests only"
    echo "  performance  Run performance tests only"
    echo "  all          Run all tests with coverage"
    echo "  ci           Run in CI mode (strict quality gates)"
    echo ""
    echo "Environment variables:"
    echo "  PERFORMANCE_TEST_ITERATIONS  Number of performance test iterations (default: 20)"
    echo "  PERFORMANCE_THRESHOLD_MS     Performance threshold in milliseconds (default: 500)"
    echo "  NODE_ENV                     Environment (test/development/production)"
}

# Main execution
main() {
    print_header
    
    local command=${1:-all}
    local unit_result=0
    local integration_result=0
    local performance_result=0
    local coverage_result=0
    local quality_gates_result=0
    
    case $command in
        "unit")
            run_unit_tests
            unit_result=$?
            ;;
        "integration")
            run_integration_tests
            integration_result=$?
            ;;
        "performance")
            run_performance_tests
            performance_result=$?
            ;;
        "all")
            run_unit_tests
            unit_result=$?
            
            run_integration_tests
            integration_result=$?
            
            run_performance_tests
            performance_result=$?
            
            run_coverage
            coverage_result=$?
            
            check_quality_gates $unit_result $integration_result $coverage_result
            quality_gates_result=$?
            
            generate_summary_report $unit_result $integration_result $performance_result $coverage_result $quality_gates_result
            ;;
        "ci")
            export NODE_ENV=test
            export CI=true
            
            run_unit_tests
            unit_result=$?
            
            if [ $unit_result -eq 0 ]; then
                run_integration_tests
                integration_result=$?
            fi
            
            if [ $integration_result -eq 0 ]; then
                run_coverage
                coverage_result=$?
            fi
            
            check_quality_gates $unit_result $integration_result $coverage_result
            quality_gates_result=$?
            
            generate_summary_report $unit_result $integration_result $performance_result $coverage_result $quality_gates_result
            
            # Exit with failure code if quality gates failed
            exit $quality_gates_result
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${BLUE}🎯 Test automation completed${NC}"
    echo "Results saved to: $RESULTS_DIR"
}

# Run main function with all arguments
main "$@"
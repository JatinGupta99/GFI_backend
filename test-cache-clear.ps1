# 🗑️ Test Cache Clear Script for Renewals API (PowerShell)
# This script demonstrates how to clear the renewal cache

$BaseUrl = "http://localhost:4020/api/renewals"

Write-Host "🧪 Testing Renewals Cache Management" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Get renewals (will cache)
Write-Host "1️⃣ Fetching renewals (will be cached)..." -ForegroundColor Yellow
$response1 = Invoke-RestMethod -Uri $BaseUrl -Method Get
Write-Host "Cached: $($response1.meta.cached)" -ForegroundColor Green
Write-Host ""

# Test 2: Get renewals again (should be from cache)
Write-Host "2️⃣ Fetching renewals again (should be cached)..." -ForegroundColor Yellow
$response2 = Invoke-RestMethod -Uri $BaseUrl -Method Get
Write-Host "Cached: $($response2.meta.cached)" -ForegroundColor Green
Write-Host ""

# Test 3: Clear cache
Write-Host "3️⃣ Clearing cache..." -ForegroundColor Yellow
$clearResponse = Invoke-RestMethod -Uri "$BaseUrl/cache/clear" -Method Post
Write-Host "Result: $($clearResponse.message)" -ForegroundColor Green
Write-Host ""

# Test 4: Get renewals after clear (should NOT be cached)
Write-Host "4️⃣ Fetching renewals after cache clear (should NOT be cached)..." -ForegroundColor Yellow
$response3 = Invoke-RestMethod -Uri $BaseUrl -Method Get
Write-Host "Cached: $($response3.meta.cached)" -ForegroundColor Green
Write-Host ""

# Test 5: Get renewals again (should be cached again)
Write-Host "5️⃣ Fetching renewals again (should be cached now)..." -ForegroundColor Yellow
$response4 = Invoke-RestMethod -Uri $BaseUrl -Method Get
Write-Host "Cached: $($response4.meta.cached)" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Cache test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Expected results:" -ForegroundColor Cyan
Write-Host "  Step 1: False (first fetch, not cached)"
Write-Host "  Step 2: True (cached)"
Write-Host "  Step 3: success message"
Write-Host "  Step 4: False (cache cleared, fresh fetch)"
Write-Host "  Step 5: True (cached again)"
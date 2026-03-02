# Batched Renewals Streaming API

## Overview
This feature allows you to fetch renewals data in batches with progressive responses. Instead of waiting for all properties to be processed, you receive data as each batch completes.

## Endpoint

### GET `/api/leasing/renewals/all/stream`

Streams renewals data using Server-Sent Events (SSE) with configurable batch processing.

**Query Parameters:**
- `batchSize` (optional): Number of properties to process per batch (default: 2)
- `delayMs` (optional): Delay between batches in milliseconds (default: 300000 = 5 minutes)

**Response Type:** `text/event-stream` (Server-Sent Events)

---

## How It Works

1. **Batch Processing**: Properties are processed in groups (default: 2 at a time)
2. **Progressive Response**: Each batch sends data immediately when ready
3. **Configurable Delay**: Wait time between batches (default: 5 minutes)
4. **Append Pattern**: Frontend receives and appends data as it arrives

---

## Usage Examples

### 1. Using cURL

```bash
curl -N 'http://localhost:4020/api/leasing/renewals/all/stream?batchSize=2&delayMs=300000' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Accept: text/event-stream'
```

**Note:** The `-N` flag disables buffering for real-time streaming.

---

### 2. Using JavaScript Fetch API

```javascript
async function streamRenewals() {
  const response = await fetch(
    'http://localhost:4020/api/leasing/renewals/all/stream?batchSize=2&delayMs=300000',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream'
      }
    }
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let allRenewals = [];

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'batch') {
          console.log(`Batch ${data.batchNumber}/${data.totalBatches} received`);
          console.log(`Properties: ${data.propertiesProcessed.join(', ')}`);
          console.log(`Renewals in batch: ${data.renewalsCount}`);
          console.log(`Progress: ${data.progress.percentage}%`);
          
          // Append batch data
          allRenewals.push(...data.data);
          
          // Update UI with new data
          updateRenewalsTable(allRenewals);
        }
        else if (data.type === 'complete') {
          console.log(`✅ Complete! Total renewals: ${data.totalRenewals}`);
        }
        else if (data.type === 'error') {
          console.error(`❌ Error: ${data.error}`);
        }
      }
    }
  }

  return allRenewals;
}
```

---

### 3. Using EventSource (Recommended for SSE)

```javascript
function streamRenewals() {
  const allRenewals = [];
  
  const eventSource = new EventSource(
    'http://localhost:4020/api/leasing/renewals/all/stream?batchSize=2&delayMs=300000',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'batch':
        console.log(`📦 Batch ${data.batchNumber}/${data.totalBatches}`);
        console.log(`   Properties: ${data.propertiesProcessed.join(', ')}`);
        console.log(`   Renewals: ${data.renewalsCount}`);
        console.log(`   Progress: ${data.progress.percentage}%`);
        
        // Append new data
        allRenewals.push(...data.data);
        
        // Update UI
        updateRenewalsTable(allRenewals);
        break;

      case 'complete':
        console.log(`✅ Complete! Total: ${data.totalRenewals}`);
        eventSource.close();
        break;

      case 'error':
        console.error(`❌ Error: ${data.error}`);
        eventSource.close();
        break;
    }
  };

  eventSource.onerror = (error) => {
    console.error('Stream error:', error);
    eventSource.close();
  };

  return eventSource;
}
```

---

### 4. React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface RenewalsBatchUpdate {
  type: 'batch' | 'complete' | 'error';
  batchNumber?: number;
  totalBatches?: number;
  propertiesProcessed?: string[];
  renewalsCount?: number;
  data?: any[];
  totalRenewals?: number;
  error?: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
}

export function useRenewalsStream(batchSize = 2, delayMs = 300000) {
  const [renewals, setRenewals] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    
    const eventSource = new EventSource(
      `/api/leasing/renewals/all/stream?batchSize=${batchSize}&delayMs=${delayMs}`
    );

    eventSource.onmessage = (event) => {
      const update: RenewalsBatchUpdate = JSON.parse(event.data);

      if (update.type === 'batch') {
        // Append new batch data
        setRenewals(prev => [...prev, ...update.data]);
        setProgress(update.progress?.percentage || 0);
      }
      else if (update.type === 'complete') {
        setIsLoading(false);
        setProgress(100);
        eventSource.close();
      }
      else if (update.type === 'error') {
        setError(update.error);
        setIsLoading(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError('Stream connection failed');
      setIsLoading(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [batchSize, delayMs]);

  return { renewals, progress, isLoading, error };
}

// Usage in component
function RenewalsPage() {
  const { renewals, progress, isLoading, error } = useRenewalsStream(2, 300000);

  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {isLoading && <ProgressBar value={progress} />}
      <RenewalsTable data={renewals} />
      <p>Loaded {renewals.length} renewals</p>
    </div>
  );
}
```

---

## Response Format

### Batch Event
```json
{
  "type": "batch",
  "batchNumber": 1,
  "totalBatches": 10,
  "propertiesProcessed": ["006146", "006147"],
  "renewalsCount": 15,
  "data": [
    {
      "id": "LEASE001",
      "tenant": "Acme Corp",
      "property": "Building A",
      "suite": "200",
      "sf": 5000,
      "expDate": "2025-12-31",
      "option": "Yes",
      "optionTerm": "Option 1: 60 months",
      "rentPerSf": 25.50,
      "status": "Renewal Negotiation"
    }
  ],
  "progress": {
    "current": 2,
    "total": 20,
    "percentage": 10
  }
}
```

### Complete Event
```json
{
  "type": "complete",
  "totalRenewals": 150,
  "data": [ /* all renewals */ ]
}
```

### Error Event
```json
{
  "type": "error",
  "error": "Failed to fetch properties"
}
```

---

## Configuration

### Adjust Batch Size
Process more properties at once (faster but more load):
```
?batchSize=5
```

### Adjust Delay
Shorter delay between batches (faster but may hit rate limits):
```
?delayMs=60000  // 1 minute
```

### Recommended Settings

**For Development:**
```
?batchSize=2&delayMs=10000  // 10 seconds
```

**For Production:**
```
?batchSize=2&delayMs=300000  // 5 minutes (default)
```

**For Quick Testing:**
```
?batchSize=1&delayMs=5000  // 5 seconds
```

---

## Benefits

1. **Progressive Loading**: See data immediately as it becomes available
2. **Better UX**: Users don't wait for all data before seeing results
3. **Rate Limit Friendly**: Configurable delays prevent API throttling
4. **Resilient**: Failed batches don't block subsequent batches
5. **Real-time Progress**: Track processing status with progress updates

---

## Comparison with Other Endpoints

| Endpoint | Type | Speed | Use Case |
|----------|------|-------|----------|
| `GET /renewals/all` | Synchronous | Slow (4+ min) | Legacy, not recommended |
| `POST /renewals/sync` | Background Job | Fast response | Queue processing, poll for status |
| `GET /renewals/cached` | Cached | Instant | Get last sync results |
| `GET /renewals/all/stream` | SSE Stream | Progressive | Real-time batch updates |

---

## Troubleshooting

### Stream Disconnects
- Check network stability
- Verify authentication token hasn't expired
- Ensure proxy/load balancer supports SSE

### No Data Received
- Verify properties exist in database
- Check server logs for errors
- Confirm MRI API is accessible

### Slow Performance
- Reduce `batchSize` to avoid rate limits
- Increase `delayMs` between batches
- Check MRI API response times

---

## Testing

```bash
# Test with 2 properties per batch, 10 second delay
curl -N 'http://localhost:4020/api/leasing/renewals/all/stream?batchSize=2&delayMs=10000' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Expected output:
# data: {"type":"batch","batchNumber":1,"totalBatches":10,...}
#
# data: {"type":"batch","batchNumber":2,"totalBatches":10,...}
#
# data: {"type":"complete","totalRenewals":150}
```

---

## Notes

- Stream stays open until all batches complete or an error occurs
- Each batch processes properties in parallel
- Failed properties in a batch don't block the batch
- All data is also returned in the final `complete` event
- Frontend should append batch data to maintain full dataset

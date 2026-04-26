# Technician Service WebSocket Events - Manual Testing Guide

## Overview
This document describes how to manually test the WebSocket event handling in the TechnicianService.

## Implementation Summary

The TechnicianService now includes:

1. **WebSocket Integration**: Injected `WebSocketService` to receive real-time events
2. **Reactive State Management**: Uses `BehaviorSubject<Technician[]>` for reactive state
3. **Event Handlers**: Subscribes to 4 technician-related WebSocket events:
   - `technician_availability_changed`
   - `technician_duty_started`
   - `technician_duty_ended`
   - `technician_updated`

## Key Features

### 1. Partial Updates (No Full Reload)
When a WebSocket event is received, only the affected technician is updated in the state:
```typescript
const technicians = this.techniciansSubject.value;
const index = technicians.findIndex(t => t.id === data.technician_id);

if (index !== -1) {
  technicians[index] = {
    ...technicians[index],
    is_available: data.is_available,
    updated_at: data.timestamp || new Date().toISOString()
  };
  this.techniciansSubject.next([...technicians]);
}
```

### 2. Real-Time Availability Indicators
The service updates availability indicators immediately when events are received, without requiring a page refresh or API call.

### 3. Observable Pattern
Components can subscribe to `technicians$` observable to receive automatic updates:
```typescript
technicianService.technicians$.subscribe(technicians => {
  // UI automatically updates when technicians change
});
```

## Manual Testing Steps

### Prerequisites
1. Backend server running with WebSocket support
2. Frontend application running
3. Workshop owner logged in
4. At least one technician associated with the workshop

### Test Case 1: Availability Change
1. Open the workshop dashboard showing technician list
2. From another device/browser, change a technician's availability
3. **Expected**: The availability indicator updates immediately without page refresh
4. **Verify**: Console shows: `✅ Technician {id} availability updated to {true/false}`

### Test Case 2: Duty Start
1. Open the workshop dashboard
2. From another device, start a technician's duty
3. **Expected**: The duty status indicator updates to "On Duty" immediately
4. **Verify**: Console shows: `✅ Technician {name} started duty`

### Test Case 3: Duty End
1. Open the workshop dashboard
2. From another device, end a technician's duty
3. **Expected**: The duty status indicator updates to "Off Duty" immediately
4. **Verify**: Console shows: `✅ Technician {name} ended duty`

### Test Case 4: Profile Update
1. Open the workshop dashboard
2. From another device, update a technician's profile (name, phone, etc.)
3. **Expected**: The technician's information updates immediately
4. **Verify**: Console shows: `✅ Technician {id} profile updated`

### Test Case 5: Multiple Technicians
1. Open the workshop dashboard with multiple technicians
2. Update one technician's availability
3. **Expected**: Only the updated technician's UI changes, others remain unchanged
4. **Verify**: No full list reload occurs

## Event Payload Structure

All events follow the standardized structure from REQ-15:

```typescript
{
  type: 'technician_availability_changed',
  data: {
    technician_id: number,
    workshop_id: number,
    first_name: string,
    last_name: string,
    is_available: boolean,
    is_on_duty: boolean,
    timestamp: string (ISO8601)
  },
  timestamp: string (ISO8601),
  version: '1.0'
}
```

## Browser Console Verification

Open the browser console and look for these log messages:

1. **WebSocket Connection**: `✅ WebSocket connected successfully`
2. **Event Reception**: `📨 WebSocket message received: technician_availability_changed`
3. **State Update**: `✅ Technician {id} availability updated to {value}`

## Integration with Components

Components should use the service like this:

```typescript
export class TechnicianListComponent {
  private technicianService = inject(TechnicianService);
  
  technicians = toSignal(this.technicianService.technicians$, { initialValue: [] });
  
  ngOnInit() {
    // Load initial data
    this.technicianService.loadTechnicians(this.workshopId);
  }
}
```

The component will automatically re-render when the `technicians$` observable emits new values.

## Troubleshooting

### Events Not Received
1. Check WebSocket connection status in console
2. Verify user is authenticated
3. Verify workshop_id matches between backend event and frontend user
4. Check browser network tab for WebSocket frames

### State Not Updating
1. Verify technician_id in event matches a technician in the current state
2. Check console for error messages
3. Verify the event type matches exactly (case-sensitive)

### Performance Issues
1. Events are throttled on the backend (max 1 per 5 seconds for location)
2. Only changed technicians are updated (no full reload)
3. BehaviorSubject ensures efficient change detection

## Compliance with Requirements

This implementation satisfies:

- **REQ-3**: Technician Management Real-Time Events
  - ✅ Availability changes emit events
  - ✅ Duty start/end emit events
  - ✅ Profile updates emit events
  - ✅ Events sent to workshop owner
  - ✅ Payload includes all required fields
  - ✅ UI updates without page refresh

- **REQ-14**: Event Naming Convention Standard
  - ✅ Uses snake_case
  - ✅ Follows {entity}_{action} pattern
  - ✅ Uses past tense for completed actions

- **REQ-15**: Event Payload Structure Standard
  - ✅ Follows standardized structure
  - ✅ Includes all necessary fields
  - ✅ Uses consistent field naming

- **REQ-16**: Broadcasting Strategy
  - ✅ Uses personal messages to workshop owner
  - ✅ Appropriate for workshop-specific events

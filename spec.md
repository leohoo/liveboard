# LiveBoard - iPad 2 Display Dashboard

## Overview
LiveBoard is a server-side controlled web dashboard system that runs on Raspberry Pi and displays on an iPad 2 (iOS 9.3.5, Safari 9) as a home display hub with always-on screen capability. The system provides real-time data visualization through Server-Sent Events, enabling a live, continuously updated display of home information, metrics, and status.

## Project Name
**LiveBoard** - Emphasizing the real-time, always-on nature of the display system.

## Requirements

### Hardware
- **Server**: Raspberry Pi (any model)
- **Client**: iPad 2 running iOS 9.3.5 with Safari 9.0
- Network connectivity between devices
- Permanent power supply for iPad (USB charger, always plugged in)
- Optional: Wall mount with cable management and ventilation

### Browser Compatibility
- Must support Safari 9.0 (iOS 9.3.5)
- Safari 9 constraints:
  - No WebAssembly
  - No Service Workers
  - No modern ES6+ features (use ES5 only)
  - No Fetch API (use XMLHttpRequest)
  - Limited CSS (use flexbox, not Grid)
  - No Web Push notifications
  - No native brightness control API
  - **Supports**: Server-Sent Events (SSE) ✓
  - **Supports**: Always-on display via Auto-Lock settings ✓

### Display Characteristics
- **Technology**: LCD (IPS) with LED backlight
- **Resolution**: 1024 x 768 pixels
- **Screen Size**: 9.7 inches
- **Burn-in Risk**: Very low (LCD technology)
- **Always-On Capable**: Yes, via Settings → Display & Brightness → Auto-Lock → Never

## Architecture

### Communication Pattern
- **Protocol**: Server-Sent Events (SSE)
- **Direction**: Server → Client (unidirectional)
- **Real-time updates**: Server pushes data and configuration to client
- **No client-side logic**: Client is a passive renderer

### Server-Side (Raspberry Pi)
- **Technology**: Node.js or Ruby (Smashing/Dashing)
- **Project Name**: LiveBoard Server
- **Responsibilities**:
  - Generate dashboard configuration
  - Fetch data from various sources (sensors, APIs, weather, etc.)
  - Push updates to connected clients via SSE
  - Provide HTTP API for remote configuration changes
  - Serve static HTML/CSS/JS client files
  - Control display modes (brightness simulation, layout changes)
  - Schedule configuration changes (day/night modes, content rotation)

### Client-Side (iPad 2 Safari)
- **Technology**: HTML5, CSS3, ES5 JavaScript
- **Project Name**: LiveBoard Client
- **Responsibilities**:
  - Connect to SSE endpoint
  - Render widgets based on server configuration
  - Update display when receiving data from server
  - Apply CSS-based brightness dimming overlays
  - No business logic or data processing
- **Display Mode**: Always-on (Auto-Lock set to Never)
- **Kiosk Mode**: Guided Access enabled to prevent accidental navigation

## Core Features

### 1. Server-Side Configuration
- Dashboard layout controlled entirely by server
- Configuration file (JSON format) defines:
  - Widget types, positions, and sizes
  - Data sources and update intervals
  - Styling and themes
  - Display modes (brightness levels, layouts)
- Configuration changes apply in real-time without client reload
- Hot-reload support for configuration file changes

### 2. Widget System
- **Widget Types**:
  - Text display (time, date, labels, messages)
  - Card (icon + value + title)
  - Gauge/Meter (progress bars, temperature, percentages)
  - Custom types as needed
- Each widget has:
  - Unique ID
  - Type
  - Title
  - Value (updated by server)
  - Custom styles (optional)
  - Update intervals (per-widget configuration)

### 3. Data Sources
- System metrics (CPU temperature, memory, network status)
- Weather APIs (current conditions, forecasts)
- Smart home sensors (temperature, humidity, motion)
- Calendar events
- Time and date
- Custom data sources via plugins or APIs

### 4. Real-Time Updates
- Server pushes updates via SSE
- Client updates DOM without page reload
- Configurable update intervals per data source
- Graceful degradation on connection loss
- Automatic reconnection on network recovery

### 5. Remote Control
- HTTP API endpoint to change configuration remotely
- File-based configuration with hot-reload
- Support for scheduled configuration changes (day/night modes, etc.)
- Multiple configuration profiles (switch between layouts)

### 6. Display Management
- **CSS-based brightness control**: Semi-transparent overlay to simulate dimming
- **Screen dimming levels**: Configurable opacity levels (0%, 25%, 50%, 75%, 90%)
- **Time-based modes**: Automatic day/night brightness adjustments
- **Layout rotation**: Optional periodic rotation through different dashboard views
- **Content refresh**: Periodic page reload to prevent LCD image retention

### 7. Burn-In Prevention
- Periodic content rotation (optional, low priority for LCD)
- Dynamic elements and subtle animations
- Scheduled screen refresh
- Content variety to prevent static display

## Technical Specifications

### SSE Event Format

#### Configuration Event
- Event type: `config`
- Contains complete dashboard layout definition
- Widget definitions with types, positions, and styles
- Layout mode (grid, list, fullscreen)

#### Update Event
- Event type: `update`
- Contains widget ID and new values
- Optional style changes
- Icon updates (for card widgets)

#### Display Control Event
- Event type: `display`
- Controls brightness overlay opacity
- Layout changes
- Content rotation triggers

### API Endpoints

- `GET /` - Serve LiveBoard client HTML page
- `GET /events` - SSE endpoint for real-time updates
- `POST /config` - Update dashboard configuration
- `GET /config` - Retrieve current configuration
- `POST /display` - Control display settings (brightness, mode)
- `GET /status` - Server health check

### Client Compatibility Requirements
- Use ES5 JavaScript syntax only (no arrow functions, const/let, template literals)
- Use XMLHttpRequest instead of Fetch API
- Use vendor-prefixed CSS (-webkit-flex, -webkit-transform, etc.)
- Use EventSource for SSE connection
- Graceful degradation for missing features
- No Service Worker or Web Worker dependencies

### Configuration File Structure

Primary configuration file (JSON format) includes:
- Layout type and dimensions
- Widget definitions array
- Global refresh intervals
- Display modes (brightness levels, schedules)
- Data source configurations
- Style themes
- LiveBoard metadata (version, name, description)

## Implementation Options

### Option 1: Smashing/Dashing (Recommended for Quick Start)
- **Pros**: Battle-tested, Safari 9 compatible, rich widget ecosystem, SSE built-in
- **Cons**: Ruby dependency, steeper learning curve
- **Use case**: Production-ready solution with minimal custom development
- **Project structure**: Rename to `liveboard-smashing`

### Option 2: Custom Node.js + SSE (Recommended for Flexibility)
- **Pros**: Full control, lightweight, simple architecture, easy to customize
- **Cons**: Build everything from scratch
- **Use case**: Maximum flexibility, custom requirements, easier integration with modern tools
- **Project structure**: Name as `liveboard-server` and `liveboard-client`

### Option 3: Hybrid Approach
- **Pros**: Use Smashing for base dashboard, extend with custom widgets and APIs
- **Cons**: Need to learn both systems
- **Use case**: Want rapid development with room for customization
- **Project structure**: `liveboard-hybrid`

## iPad Configuration

### Required Settings
1. **Auto-Lock**: Settings → Display & Brightness → Auto-Lock → **Never**
2. **Low Power Mode**: Settings → Battery → Low Power Mode → **OFF**
3. **Auto-Brightness**: Settings → Accessibility → Display & Text Size → Auto-Brightness → **OFF** (or ON based on preference)
4. **Brightness Level**: Manual setting to desired level

### Optional Settings (Recommended for Kiosk Use)
1. **Guided Access**: Settings → Accessibility → Guided Access → **ON**
   - Prevents exiting Safari or changing settings
   - Triple-click Home button to enable/disable
2. **Passcode**: Settings → Touch ID & Passcode → Turn Passcode **OFF**
   - Only if iPad is in secure location
3. **Notifications**: Disable all notifications to prevent interruptions
4. **Automatic Updates**: Settings → General → Software Update → Automatic Updates → **OFF**

### Physical Setup
- Permanent power connection (10W+ USB charger)
- Wall mount or stand with cable management
- Adequate ventilation to prevent overheating
- Positioned for optimal viewing angle
- Protected from direct sunlight (to prevent screen glare and heat)

## Non-Functional Requirements

### Performance
- Smooth rendering on iPad 2 (limited hardware)
- Minimal JavaScript execution
- Optimized DOM updates (batch updates when possible)
- Efficient memory usage
- Fast SSE reconnection
- Target: < 100ms update latency

### Reliability
- Auto-reconnect on SSE connection loss
- Graceful degradation on network issues
- Server-side error handling
- Client-side fallback content
- Periodic health checks
- Target: 99.9% uptime for home use

### Usability
- Kiosk mode ready (Guided Access on iOS)
- Full-screen capable
- No user interaction required after initial setup
- Clear visual feedback for data updates
- Readable from typical viewing distance (2-3 meters)
- Intuitive widget layout

### Maintainability
- Configuration changes without code modification
- Clear separation between server and client
- Modular widget system
- Comprehensive logging
- Version control for configurations
- Documentation for all components

### Security
- Local network only (no internet exposure required)
- Optional HTTP authentication for configuration API
- Minimal attack surface
- No sensitive data storage on client
- HTTPS optional for production environments

### Power and Display Management
- Continuous operation (24/7)
- Heat management through ventilation
- LCD image retention prevention through content rotation
- Battery health monitoring (though always plugged in)
- Automatic recovery from power interruptions
- Energy-efficient SSE implementation

## Display Modes

### Day Mode
- Full or high brightness
- Vibrant colors
- Detailed information display
- Active widget animations

### Night Mode
- CSS overlay dimming (50-90% opacity)
- Reduced color saturation (optional)
- Essential information only (optional)
- Minimal animations

### Screensaver Mode (Optional)
- Activated during specific hours or inactivity
- Minimal static content
- Very low brightness
- Prevents complete LCD image retention

### Layout Rotation (Optional)
- Cycle through multiple dashboard layouts
- Configurable rotation interval (hourly, daily)
- Smooth transitions
- Prevents static display patterns

## Error Handling and Recovery

### Client-Side
- SSE connection loss: Display "LiveBoard Connecting..." indicator
- Network failure: Retry connection with exponential backoff
- Configuration error: Fall back to last known good configuration
- Display error: Log to console, attempt graceful degradation

### Server-Side
- Data source failure: Return cached data or default values
- API timeout: Implement request timeouts and retries
- Configuration validation: Reject invalid configurations
- Memory management: Monitor and limit resource usage
- Logging: Comprehensive error logging with timestamps

## Monitoring and Maintenance

### Server Monitoring
- SSE connection count
- Data source health
- API response times
- Error rates and logging
- Memory and CPU usage
- Network bandwidth

### Client Monitoring (Limited)
- Connection status visible in dashboard (optional)
- Last update timestamp
- Error display (optional, for debugging)
- LiveBoard version display

### Maintenance Tasks
- Regular configuration backups
- Log rotation
- Periodic dashboard content refresh
- Monthly iPad screen cleaning
- Quarterly review of widget relevance
- Software updates for server components

## Repository Structure

### Recommended Git Repository Layout
```
liveboard/
├── README.md
├── LICENSE
├── server/
│   ├── config/
│   ├── widgets/
│   ├── data-sources/
│   └── public/
├── client/
│   ├── index.html
│   ├── styles/
│   └── scripts/
└── docs/
    ├── setup.md
    ├── configuration.md
    └── api.md
```

## Branding and Identity

### Project Identity
- **Name**: LiveBoard
- **Tagline**: "Real-time home display, always live"
- **Philosophy**: Server-controlled, client-rendered, continuously updated
- **Target Use Case**: Home information hub, kiosk displays, monitoring dashboards

### Visual Identity (Optional)
- Modern, minimal aesthetic
- Clean sans-serif typography
- Data-first design
- Emphasis on readability and glanceability

## Future Enhancements
- Multiple dashboard views with rotation
- Touch gesture support for manual page switching
- Screenshot/history logging
- Multiple client support with different configurations per device
- Plugin system for custom data sources
- Authentication for remote configuration API
- Mobile app for remote LiveBoard control
- Voice control integration (via external service)
- Advanced scheduling (holiday modes, event-based displays)
- Integration with smart home platforms (Home Assistant, HomeKit)
- WebSocket fallback for older browsers
- Multi-language support
- Theme marketplace/community themes
- Analytics and usage tracking
- Automated backup and restore

# Whiteout Spot Organizer

A multi-page web application for organizing spots on a grid map, built with Node.js, Express, SQLite, and vanilla JavaScript.

## Features

### Core Functionality
- **Grid Map View** (`/map`): Interactive scrollable grid centered at (0,0)
- **List View** (`/list`): Sidebar with searchable list of all cities
- **Admin/Viewer Modes**: Different permissions for different users
- **City Management**: Insert, edit, delete cities with full CRUD operations (admin only)
- **Auto-Insert**: Quick city placement for admin users
- **Status Toggle**: Long-press (700ms) to toggle between occupied/reserved (admin only)
- **Color Customization**: Each city can have a custom color
- **Search & Filter**: Search by name, filter by status and level
- **Mobile-Friendly**: Responsive design for mobile devices
- **Persistent Storage**: SQLite database for data persistence
- **User Management**: Create, update, delete panel users
- **Audit Logging**: Track changes to cities and users

### City Properties
- **ID**: Unique identifier (auto-generated)
- **Name**: City/member name
- **Level**: Numeric level (1-100)
- **Status**: "occupied" or "reserved"
- **Coordinates**: X, Y position on the grid
- **Notes**: Optional text notes
- **Color**: Custom color for visual distinction

### UI Features
- **Responsive Design**: Mobile-first approach with TailwindCSS
- **Mobile Optimization**: Smaller grid and touch-friendly interface on mobile
- **Zoom Control**: Adjustable zoom level (55% - 200%)
- **Bear Trap Highlight**: manage up to two 2×2 zones via a popup after clicking the map
- **Trap Persistence**: Trap locations and colors stored server-side and shared across devices
- **Hover Effects**: Interactive highlighting and tooltips
- **Modal Dialogs**: Clean add/edit interface
- **Real-time Updates**: Instant reflection of changes
- **User Mode Indicator**: Shows current user mode (Admin/View Only)

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML, TailwindCSS, Vanilla JavaScript
- **Testing**: Jest for backend tests

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whiteout-spot-organizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Log in**
   - Default admin credentials: `admin` / `admin`
   - Authenticate via `POST /api/login`

5. **Access the application**
   - Main page: http://localhost:3000
   - Map view: http://localhost:3000/map
   - List view: http://localhost:3000/list

## Development

### Running in Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
```

### Resetting the database
Set the `RESET_DB` environment variable to clear existing data when the server
starts:

```bash
RESET_DB=true npm start
```

### Project Structure
```
whiteout-spot-organizer/
├── server.js              # Express server with API routes
├── package.json           # Dependencies and scripts
├── public/                # Static files
│   ├── map.html          # Map view page
│   ├── list.html         # List view page
│   ├── css/
│   │   └── tailwind.css  # Custom styles
│   └── js/
│       ├── map.js        # Map view logic
│       └── list.js       # List view logic
└── tests/
    └── database.test.js  # Jest tests for database operations
```

## API Endpoints

### Cities CRUD
- `GET /api/cities` - Get all cities
- `POST /api/cities` - Create new city
- `PUT /api/cities/:id` - Update existing city
- `DELETE /api/cities/:id` - Delete city

### Import/Export
- `GET /api/export` - Export all cities and traps as JSON (versioned payload)
- `POST /api/import` - Import cities and traps from JSON (replaces all data)

### Traps CRUD
- `GET /api/traps` - List traps (public)
- `POST /api/traps` - Create or replace trap (admin only)
- `PUT /api/traps/:id` - Update trap (admin only)
- `DELETE /api/traps/:id` - Remove trap (admin only)

### Snapshot
- `GET /api/snapshot` - Combined cities & traps with ETag for syncing

### Users CRUD
- `GET /api/users` - List users
- `POST /api/users` - Create or replace user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Remove user

### Audit Logs
- `GET /api/audit` - List audit log entries

## Usage

### User Modes
- **Admin Mode**: Access via `?admin=true` URL parameter or localStorage
- **Viewer Mode**: Default mode, read-only access

### Adding a City (Admin Only)
1. Click on an empty tile on the map, or
2. Click "Insert City" button to add at (0,0), or
3. Click "Auto Insert" for quick placement
4. Fill in the city details in the modal
5. Click "Save"

### Auto-Insert (Admin Only)
1. Click "Auto Insert" button
2. Enter member name and level
3. City will be automatically placed in an empty spot near center

### Editing a City (Admin Only)
1. Click on an existing city on the map, or
2. Click on a city in the list view
3. Modify the details in the modal
4. Click "Save"

### Viewing City Info (Viewer Mode)
1. Click on any city to view its details
2. Information is displayed in a popup

### Deleting a City (Admin Only)
1. Open the edit modal for a city
2. Click the "Delete" button
3. Confirm the deletion

### Toggling Status (Admin Only)
- Long-press (700ms) on any city to toggle between occupied/reserved

### Bear Traps (Admin Only)
1. Click an empty tile on the map to open the action popup.
2. Choose **Trap 1** or **Trap 2** and pick a color to place a 2×2 trap, or select **Insert City** to add a city instead.
3. Click any trapped tile to adjust its color or use **Delete Trap**.

### Searching and Filtering
- Use the search box to find cities by name
- Use status and level filters in the list view
- Hover over list items to highlight cities on the map

### Mobile Usage
- Responsive design adapts to screen size
- Touch-friendly interface
- Smaller grid on mobile devices

## Testing

The application includes comprehensive tests:

### Backend Tests
- Database CRUD operations
- Constraint validation
- Error handling

### Frontend Self-Tests
- Grid construction validation
- Coordinate system verification
- Filtering functionality
- Status toggle verification

To run self-tests, add `#test` to any page URL (e.g., `http://localhost:3000/map#test`)

## Database Schema

```sql
CREATE TABLE cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER,
  status TEXT NOT NULL DEFAULT 'occupied',
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  notes TEXT,
  color TEXT DEFAULT '#ec4899'
);

CREATE TABLE traps (
  id TEXT PRIMARY KEY,
  slot INTEGER UNIQUE CHECK(slot IN (1,2)),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#f59e0b',
  notes TEXT
);
```

## Browser Compatibility

- Modern browsers with ES6+ support
- Mobile browsers with touch support
- Chrome, Firefox, Safari, Edge

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Support

For issues and questions, please create an issue in the repository.

### Build CSS
The app now bundles Tailwind locally. CSS builds automatically on install via postinstall. To build manually:
```bash
npm run build:css
```
pm run build:css.

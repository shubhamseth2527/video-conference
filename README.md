# Video Conferencing App

This project is a video conferencing application that allows users to join rooms and communicate via video. It features a dashboard for user input and an admin interface for managing calls.

## Project Structure

```
video-conferencing-app
├── public
│   ├── client.js        # Client-side JavaScript for handling user interactions
│   ├── dashboard.html   # HTML dashboard for user input and video display
│   └── style.css        # CSS styles for the dashboard
├── src
│   └── server.js        # Node.js backend for managing connections and rooms
├── package.json         # npm configuration file
└── README.md            # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd video-conferencing-app
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the server:**
   ```
   node src/server.js
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000` to access the dashboard.

## Usage

- Users can input their room ID and username on the dashboard.
- The admin can join the room and initiate calls once users have joined.
- The application supports picture-in-picture mode for video calls.

## Contributing

Feel free to submit issues or pull requests for improvements and bug fixes.
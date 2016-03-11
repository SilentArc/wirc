## wirc
Websocket based IRC client

## Usage
Requires jquery.
Include wirc.js or wirc.min.js with the data-addr attribute containing the location of the websocket you wish to connect to.
Wirc will empty and fill the parental element and include wirc.css itself.
```HTML
<div>
	<span>javascript requirement warning</spam>
	<script src="wirc.js" data-addr="ws://websocketURL"></script>
</div>
```

## Build
1. Change to the project's root directory
2. Install dependencies
```
npm install
```
3. Run grunt to build
```
grunt
```
# minecraft-socket

Run multiple minecraft servers in the background

Run `python3 -m main.py --config path/to/config.json` or equivalent to make it go
If you don't include `--config` itll just assume you've been good and put ur config in config.json in the cwd
Also probably install the requirements
Those are important

## Configuration

```json
{
    "runtime": {
        "host": ip/localhost,
        "port": port number
    },
    "logging": {
        "format": "%(filename)s:%(lineno)s:%(name)s.%(levelname)s @ %(asctime)s > %(message)s",
        "level": "INFO"
    },
    "database": {
        "ip": ip,
        "port": port,
        "database": "minecraft_socket",
        "username": null,
        "password": null,
        "secure": false
    },
    "password": pick one idk,
    "connection_timeout": a long number in seconds,
    "server_folder": some kinda path, you'll figure it out <3
}
```

Have fun mining away
Its 1 am i need to go to sleep

## A control plane for coding-agent runtimes

MindWire gives you one console for managing agents, credentials, and sessions while keeping the underlying runtime private.

The catalog defines the control plane and runtime together. The runtime stays behind the project network, and users enter through the console's public route.

## Build around the control plane

Open the console after deployment and configure the credentials and runtime settings your agents need. Keep private runtime access separate from the console address.

See the [MindWire source project](https://github.com/oblien/mindwire) for supported integrations and application APIs. Use the normal app configuration and backup flows to protect persistent data.

import { CopilotClient } from "../nodejs/dist/index.js";

function isUnsupportedMethodError(error) {
    return (
        !!error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === -32601 &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.includes("session.agent.")
    );
}

async function main() {
    const client = new CopilotClient({ useStdio: true });

    try {
        await client.start();

        const session = await client.createSession({
            model: "claude-sonnet-4.5",
            customAgents: [
                {
                    name: "agent-a",
                    displayName: "Agent A",
                    prompt: "You are Agent A.",
                    infer: true,
                },
                {
                    name: "agent-b",
                    displayName: "Agent B",
                    prompt: "You are Agent B.",
                    infer: true,
                },
            ],
        });

        console.log("Session:", session.sessionId);

        try {
            const before = await session.rpc.agent.getCurrent();
            console.log("Current agent:", before);

            const switched = await session.rpc.agent.switchTo({ agentName: "agent-b" });
            console.log("Switch result:", switched);

            const after = await session.rpc.agent.getCurrent();
            console.log("Current agent after switch:", after);
            console.log("Agent RPC is supported by this CLI backend.");
        } catch (error) {
            if (isUnsupportedMethodError(error)) {
                console.log("CLI backend does not implement session.agent.* yet.");
                console.log("SDK wiring is present; backend support is still required.");
                await session.destroy();
                await client.stop();
                return;
            }
            throw error;
        }

        await session.destroy();
        await client.stop();
        console.log("Done.");
    } catch (error) {
        console.error("Agent switch check failed.");
        console.error(error);
        try {
            await client.stop();
        } catch {
            // ignore cleanup error
        }
        process.exit(1);
    }
}

void main();

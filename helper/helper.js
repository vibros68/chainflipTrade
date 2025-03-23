export async function waitFor(seconds, logDot) {
    for (let i = 0; i < seconds; i++) {
        await new Promise(resolver => {
            setTimeout(resolver,1000)
        })
        if (logDot) {
            process.stdout.write(".")
        }
    }
}
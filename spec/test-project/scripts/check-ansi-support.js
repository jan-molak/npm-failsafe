async function run() {
	const supportsColor = await import('supports-color');
	return supportsColor.default;
}

run().then(result => {
	if (result.stdout) {
		console.log('Colors supported')
		process.exit(0);
	}
	console.log('Colors not supported')
	process.exit(0);
});

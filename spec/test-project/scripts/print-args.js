console.log(`Listing ${process.argv.length - 2} arguments`);
for (const arg of process.argv.splice(2)) {
  console.log(JSON.stringify(arg));
}
process.exit(0);

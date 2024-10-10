const { spawn } = require('child_process');

const commands = [
  'node scripts/api/importDeck/import.mjs -p scripts/api --oldDeckId 129318 --user test_admin --password Test1234 --host localhost --port 4000 --protocol http --testAuto NONE',
  'node scripts/api/importDeck/import.mjs -p scripts/api --oldDeckId 131196 --user test_admin --password Test1234 --host hipocampo-pr-779.herokuapp.com --port none --protocol https --testAuto NONE',
  'node scripts/api/importDeck/import.mjs -p scripts/api --user hipocampo1 --password Buster22! --host www.hipocampo.com --oldDeckId "English Vocab Tutorial" --port none --protocol https --testAuto NONE',
  'node scripts/api/importDeck/import.mjs -p scripts/api --user test_admin --password Test1234 --host localhost --oldDeckId "English Vocab Tutorial" --port 4000 --protocol http --testAuto PERM',
  'node scripts/api/importDeck/import.mjs -p scripts/api --user hipocampo1 --password Test1234 --host localhost --oldDeckId "Periodic Table" --port 4000 --protocol http --testAuto NONE --renameConflict'
];

commands.forEach((command) => {
  const child = spawn(command, { shell: true });

  child.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
});

import 'dotenv/config';
import app from './src/app.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`CSE 340 volunteer site listening on port ${port}`);
});

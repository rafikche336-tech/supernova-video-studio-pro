import Link from 'next/link';
import styles from './status.module.css';

export default function NotFound() {
  return (
    <main className={styles.wrapper}>
      <h1 className={styles.title}>404 — page not found</h1>
      <p className={styles.text}>That page does not exist. The studio is one click away.</p>
      <Link className={styles.action} href="/">
        Back to the studio
      </Link>
    </main>
  );
}

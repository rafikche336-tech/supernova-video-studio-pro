import styles from './status.module.css';

export default function Loading() {
  return (
    <main className={styles.wrapper} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.text}>Loading the studio…</p>
    </main>
  );
}

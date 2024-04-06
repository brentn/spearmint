export class Time {
  static Ago(pastDate: number | Date | undefined): string {
    if (!pastDate) return '';
    if (!(pastDate instanceof Date)) pastDate = new Date(pastDate);
    const now = new Date();
    if (pastDate > now) throw new Error('Date not in the past');
    const seconds = (now.getTime() - pastDate.getTime()) / 1000;
    if (seconds < 60) return 'just now';
    const minutes = seconds / 60;
    if (minutes < 60) return `${Math.floor(minutes)} minutes ago`;
    const hours = minutes / 60;
    if (hours < 24) return `${Math.floor(hours)} hours ago`;
    const days = hours / 24;
    if (days < 7) return `${Math.floor(days)} days ago`;
    const weeks = days / 7;
    return `${Math.floor(weeks)} weeks ago`;
  }
}

// lib/utils/dateUtils.ts

export class DateUtils {
  /**
   * Retorna a segunda-feira da semana civil da data fornecida (00:00:00)
   */
  static getWeekStartDate(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Dom) a 6 (Sáb)
    // Ajuste para garantir que a semana comece na Segunda-feira
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Retorna o domingo da semana civil da data fornecida (23:59:59)
   */
  static getWeekEndDate(date: Date = new Date()): Date {
    const start = this.getWeekStartDate(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Retorna o número da semana no ano (ISO-8601)
   */
  static getWeekNumber(date: Date = new Date()): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
  }

  /**
   * Retorna o índice do dia da semana (0-6)
   */
  static getDayOfWeek(date: Date = new Date()): number {
    return date.getDay();
  }

  /**
   * Formata intervalo de datas (ex: "20 abr - 26 abr")
   */
  static formatWeekRange(startDate: Date, endDate: Date): string {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const startStr = startDate.toLocaleDateString('pt-BR', options);
    const endStr = endDate.toLocaleDateString('pt-BR', options);
    return `${startStr} - ${endStr}`;
  }

  /**
   * Verifica se é o mesmo dia
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }

  /**
   * Retorna o período do dia
   */
  static getTimeOfDay(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = date.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 24) return 'evening';
    return 'night';
  }

  /**
   * Adiciona semanas a uma data
   */
  static addWeeks(date: Date, weeks: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + weeks * 7);
    return result;
  }

  static parseDateFromStorage(dateString: string): Date {
    return new Date(dateString);
  }

  static formatDateForStorage(date: Date): string {
    return date.toISOString();
  }
}
// lib/utils/dateUtils.ts

export class DateUtils {
  /**
<<<<<<< HEAD
   * Retorna a segunda-feira da semana civil da data fornecida (00:00:00)
   */
  static getWeekStartDate(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Dom) a 6 (Sáb)
    // Ajuste para garantir que a semana comece na Segunda-feira
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
=======
   * Retorna o início da semana (Segunda-feira) com hora zerada
   */
  static getWeekStartDate(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 (Dom) a 6 (Sab)
    // Ajuste para Segunda-feira ser o início (1). Se for Domingo (0), volta 6 dias.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
>>>>>>> fcbeaae (lógica calendário civil estabelecida)
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

<<<<<<< HEAD
  /**
   * Retorna o número da semana no ano (ISO-8601)
   */
=======
  static getDayOfWeek(date: Date = new Date()): number {
    return date.getDay(); // 0 (Domingo) a 6 (Sábado)
  }

  /**
   * 🔥 NOVO: Calcula a data exata da atividade baseada na Segunda-feira de início
   * Se o cronograma começa dia 27 (Segunda), e a atividade é dia 1 (Segunda), retorna 27.
   * Se a atividade é dia 5 (Sexta), retorna dia 31.
   */
  static calculateActivityDate(weekStartDate: Date, activityDayOfWeek: number): Date {
    const result = new Date(weekStartDate);
    // Como weekStartDate já é Segunda, se activityDayOfWeek for 1 (Segunda), soma 0.
    // Se activityDayOfWeek for 0 (Domingo), soma 6.
    const daysToAdd = activityDayOfWeek === 0 ? 6 : activityDayOfWeek - 1;
    result.setDate(result.getDate() + daysToAdd);
    result.setHours(0, 0, 0, 0);
    return result;
  }

>>>>>>> fcbeaae (lógica calendário civil estabelecida)
  static getWeekNumber(date: Date = new Date()): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
  }

<<<<<<< HEAD
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
=======
  static addWeeks(date: Date, weeks: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + weeks * 7);
    return result;
>>>>>>> fcbeaae (lógica calendário civil estabelecida)
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

<<<<<<< HEAD
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
=======
  static formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  static getDayName(dayIndex: number): string {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dayIndex] || 'Dia inválido';
>>>>>>> fcbeaae (lógica calendário civil estabelecida)
  }
}
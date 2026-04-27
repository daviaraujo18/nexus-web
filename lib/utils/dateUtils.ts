// lib/utils/dateUtils.ts

export class DateUtils {
  /**
   * 📅 Retorna a Segunda-feira da semana de uma data específica
   * Garante que a hora seja 00:00:00 para comparações precisas
   */
  static getWeekStartDate(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Domingo, 1 = Segunda...
    
    // Ajuste: Se for domingo (0), volta 6 dias. Se não, volta (dia - 1)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    
    console.log(`📏 [DateUtils] Calculando Início da Semana para ${date.toLocaleDateString()}:`, monday.toLocaleDateString());
    return monday;
  }

  /**
   * 🏁 Retorna o Domingo (fim da semana) com hora 23:59:59
   */
  static getWeekEndDate(date: Date = new Date()): Date {
    const monday = this.getWeekStartDate(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return sunday;
  }

  /**
   * 🛠️ Calcula a data real de uma atividade baseada no dia da semana (0-6)
   * Onde 0 = Segunda, 6 = Domingo (seguindo seu padrão de cronograma)
   */
  static calculateActivityDate(weekStartDate: Date, dayOfWeek: number): Date {
    const result = new Date(weekStartDate);
    // Se weekStartDate é Segunda, somar dayOfWeek (0 = Segunda, 1 = Terça...)
    result.setDate(weekStartDate.getDate() + dayOfWeek);
    result.setHours(0, 0, 0, 0);
    
    return result;
  }

  /**
   * 🔍 Verifica se uma data está dentro de um intervalo (inclusive)
   */
  static isWithinRange(date: Date, start: Date, end: Date): boolean {
    const t = date.getTime();
    return t >= start.getTime() && t <= end.getTime();
  }

  /**
   * 📝 Formata o intervalo da semana para exibição (ex: 20/04 - 26/04)
   */
  static formatWeekRange(date: Date = new Date()): string {
    const start = this.getWeekStartDate(date);
    const end = this.getWeekEndDate(date);

    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
    return `${start.toLocaleDateString('pt-BR', options)} - ${end.toLocaleDateString('pt-BR', options)}`;
  }

  static addWeeks(date: Date, weeks: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + weeks * 7);
    return result;
  }

  static getDayOfWeek(date: Date): number {
    return date.getDay();
  }

  static getDaysBetween(d1: Date, d2: Date): number {
    const ms = Math.abs(new Date(d2).getTime() - new Date(d1).getTime());
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  static getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  }

  static isSameDay(d1: Date, d2: Date): boolean {
    const a = new Date(d1);
    const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  static getTimeOfDay(date: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
    const h = new Date(date).getHours();
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'afternoon';
    if (h >= 18 && h < 24) return 'evening';
    return 'night';
  }
}
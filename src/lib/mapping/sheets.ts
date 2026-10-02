/**
 * TUTVSE Search MVP 0.5
 * Google Sheets -> normalized DatabaseEntry mapping layer.
 *
 * This module is intentionally dependency-free.
 * It is designed to be imported by the server-side Google Sheets reader.
 */

export type DatabaseEntry = {
  id: string;
  category: string;

  specialization?: string;
  subspecialization?: string;

  title: string;
  name?: string;
  company?: string;
  city?: string;

  phone?: string;
  telegram?: string;
  email?: string;

  description?: string;
  portfolio?: string;
  payment?: string;

  comment?: string;
  review?: string;

  sourceSheet: PublishedSheetName;
  sourceRow: number;
};

export type PublishedSheetName =
  | "Аренда мебели/оборудования"
  | "Артисты"
  | "Ведущие / Диджеи"
  | "Декор / Флористика"
  | "Диджитал"
  | "Дизайн / Креатив"
  | "Кавер-группы/исполнители"
  | "Кейтеринг // Бары // кальянный кейтеринг"
  | "Спикеры/тимбилдинг/мастер-классы/аниматоры"
  | "Менеджеры"
  | "Площадки"
  | "Промо-персонал"
  | "Производство / Типография"
  | "Разное"
  | "Регистрация"
  | "Тех. продакшн/застройка "
  | "Фото / Продакшн";

export const EXCLUDED_SHEETS = [
  "Содержание",
  "Маркетинговые отделы",
  "Ответы на форму",
  "Ответы с сайта",
] as const;

export type RawRow = Record<string, unknown>;

type DatabaseField =
  | "specialization"
  | "subspecialization"
  | "name"
  | "company"
  | "city"
  | "phone"
  | "telegram"
  | "email"
  | "description"
  | "portfolio"
  | "payment"
  | "comment"
  | "review";

type FieldMapping = Partial<Record<DatabaseField, readonly string[]>>;

type SheetConfig = {
  sheet: PublishedSheetName;
  mapping: FieldMapping;
  titlePriority: readonly ("company" | "name")[];
  staticCity?: string;
};

const EMPTY_MARKERS = new Set([
  "",
  "-",
  "—",
  "–",
  "-------",
  "null",
  "undefined",
  "n/a",
  "нет",
]);

export function cleanCell(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  const cleaned = String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!cleaned) return undefined;
  if (EMPTY_MARKERS.has(cleaned.toLowerCase())) return undefined;

  return cleaned;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

function getByHeaderAliases(
  row: RawRow,
  aliases: readonly string[],
): string | undefined {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));

  for (const [header, rawValue] of Object.entries(row)) {
    if (!normalizedAliases.has(normalizeHeader(header))) continue;
    const value = cleanCell(rawValue);
    if (value) return value;
  }

  return undefined;
}

function getAllByHeaderAliases(
  row: RawRow,
  aliases: readonly string[],
): string[] {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  const values: string[] = [];

  for (const [header, rawValue] of Object.entries(row)) {
    if (!normalizedAliases.has(normalizeHeader(header))) continue;
    const value = cleanCell(rawValue);
    if (value) values.push(value);
  }

  return values;
}

function joinUnique(values: Array<string | undefined>): string | undefined {
  const normalized = values
    .map(cleanCell)
    .filter((value): value is string => Boolean(value));

  const unique = [...new Set(normalized)];
  return unique.length ? unique.join(" · ") : undefined;
}

export function normalizeTelegram(value: string | undefined): string | undefined {
  const cleaned = cleanCell(value);
  if (!cleaned) return undefined;

  const pieces = cleaned
    .split(/\s+|,|;/)
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized = pieces.map((piece) => {
    const username = piece
      .replace(/^https?:\/\/t\.me\//i, "")
      .replace(/^@+/, "")
      .replace(/\/+$/, "")
      .trim();

    if (/^[A-Za-z0-9_]{4,}$/.test(username)) {
      return `@${username}`;
    }

    return piece;
  });

  return joinUnique(normalized);
}

export function telegramHref(value: string | undefined): string | undefined {
  const cleaned = cleanCell(value);
  if (!cleaned) return undefined;

  const first = cleaned.split(" · ")[0]?.trim();
  if (!first) return undefined;

  if (/^https?:\/\/t\.me\//i.test(first)) return first;

  const username = first.replace(/^@+/, "");
  if (/^[A-Za-z0-9_]{4,}$/.test(username)) {
    return `https://t.me/${username}`;
  }

  return undefined;
}

export function phoneHref(value: string | undefined): string | undefined {
  const cleaned = cleanCell(value);
  if (!cleaned) return undefined;

  const firstPhone = cleaned.match(/\+?\d[\d\s()\-]{7,}\d/);
  if (!firstPhone) return undefined;

  let digits = firstPhone[0].replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length < 10) return undefined;
  return `tel:+${digits}`;
}

function slugify(value: string): string {
  const translit: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e",
    ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };

  return value
    .toLowerCase()
    .split("")
    .map((char) => translit[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createStableId(sheet: PublishedSheetName, sourceRow: number): string {
  return `${slugify(sheet)}-${sourceRow}`;
}

const COMMON_PERSON_OR_COMPANY_MAPPING: FieldMapping = {
  specialization: [
    "Специализация\nключевое слово для поиска",
    "Специализация ключевое слово для поиска",
    "Специализация",
  ],
  company: ["Название компании"],
  name: [
    "Имя\nфамилия , прозвище, как обращаться к вам",
    "Имя фамилия , прозвище, как обращаться к вам",
    "Имя",
  ],
  phone: [
    "Номер телефона\nдля получения заказов",
    "Номер телефона для получения заказов",
    "Телефон",
  ],
  telegram: [
    "Ссылка на личную телегу\nдля получения заказов",
    "Ссылка на личную телегу для получения заказов",
    "Телеграм",
    "Telegram",
  ],
  description: [
    "Я умею и могу (хочу и люблю) делать",
    "Дополнительная информация",
    "Детали",
  ],
  portfolio: [
    "Где можно посмотреть примеры работ (портфолио)",
    "Ссылки",
  ],
  payment: ["Форма оплаты\nдайте несколько вариантов", "Форма оплаты дайте несколько вариантов"],
  comment: ["Комментарий", "Комментарии"],
  review: ["Отзыв"],
};

export const SHEET_CONFIGS: Record<PublishedSheetName, SheetConfig> = {
  "Аренда мебели/оборудования": {
    sheet: "Аренда мебели/оборудования",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      description: ["Детали"],
      portfolio: ["Ссылки"],
    },
    titlePriority: ["company", "name"],
  },

  "Артисты": {
    sheet: "Артисты",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      company: [],
    },
    titlePriority: ["name"],
  },

  "Ведущие / Диджеи": {
    sheet: "Ведущие / Диджеи",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      company: ["Названии компании / артиста", "Название компании / артиста"],
    },
    titlePriority: ["company", "name"],
  },

  "Декор / Флористика": {
    sheet: "Декор / Флористика",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
    },
    titlePriority: ["company", "name"],
  },

  "Диджитал": {
    sheet: "Диджитал",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
    },
    titlePriority: ["company", "name"],
  },

  "Дизайн / Креатив": {
    sheet: "Дизайн / Креатив",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      subspecialization: ["Узкая специализация"],
      company: [],
    },
    titlePriority: ["name"],
  },

  "Кавер-группы/исполнители": {
    sheet: "Кавер-группы/исполнители",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      company: [],
    },
    titlePriority: ["name"],
  },

  "Кейтеринг // Бары // кальянный кейтеринг": {
    sheet: "Кейтеринг // Бары // кальянный кейтеринг",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
    },
    titlePriority: ["company", "name"],
  },

  "Спикеры/тимбилдинг/мастер-классы/аниматоры": {
    sheet: "Спикеры/тимбилдинг/мастер-классы/аниматоры",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
    },
    titlePriority: ["company", "name"],
  },

  "Менеджеры": {
    sheet: "Менеджеры",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      subspecialization: ["Узкая специлизация", "Узкая специализация"],
      company: ["Компания"],
      city: ["Город"],
      email: ["Почта", "Email", "E-mail"],
      payment: ["Форма оплаты\nдайте несколько вариантов", "Форма оплаты дайте несколько вариантов"],
    },
    titlePriority: ["name", "company"],
  },

  "Площадки": {
    sheet: "Площадки",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      company: ["Название площадки"],
      name: [
        "Имя\nфамилия , прозвище, как обращаться к вам",
        "Имя фамилия , прозвище, как обращаться к вам",
      ],
      description: ["Детали"],
      portfolio: ["Ссылки"],
    },
    titlePriority: ["company", "name"],
  },

  "Промо-персонал": {
    sheet: "Промо-персонал",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      company: [],
    },
    titlePriority: ["name"],
  },

  "Производство / Типография": {
    sheet: "Производство / Типография",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      name: [],
    },
    titlePriority: ["company"],
  },

  "Разное": {
    sheet: "Разное",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
    },
    titlePriority: ["company", "name"],
  },

  "Регистрация": {
    sheet: "Регистрация",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
    },
    titlePriority: ["company", "name"],
  },

  "Тех. продакшн/застройка ": {
    sheet: "Тех. продакшн/застройка ",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      description: ["Дополнительная информация"],
      payment: [],
      comment: [],
    },
    titlePriority: ["company", "name"],
  },

  "Фото / Продакшн": {
    sheet: "Фото / Продакшн",
    mapping: {
      ...COMMON_PERSON_OR_COMPANY_MAPPING,
      company: [],
    },
    titlePriority: ["name"],
  },
};

export const PUBLISHED_SHEETS = Object.keys(
  SHEET_CONFIGS,
) as PublishedSheetName[];

function resolveField(
  row: RawRow,
  config: SheetConfig,
  field: DatabaseField,
): string | undefined {
  const aliases = config.mapping[field] ?? [];

  if (field === "payment") {
    const payments = getAllByHeaderAliases(row, aliases);
    return joinUnique(payments);
  }

  return getByHeaderAliases(row, aliases);
}

function resolveTitle(
  config: SheetConfig,
  fields: Pick<DatabaseEntry, "company" | "name">,
): string | undefined {
  for (const candidate of config.titlePriority) {
    const value = cleanCell(fields[candidate]);
    if (value) return value;
  }
  return undefined;
}

export function mapSheetRow(
  sheet: PublishedSheetName,
  sourceRow: number,
  rawRow: RawRow,
): DatabaseEntry | null {
  const config = SHEET_CONFIGS[sheet];
  if (!config) return null;

  const specialization = resolveField(rawRow, config, "specialization");
  const subspecialization = resolveField(rawRow, config, "subspecialization");

  const name = resolveField(rawRow, config, "name");
  const company = resolveField(rawRow, config, "company");
  const city = config.staticCity ?? resolveField(rawRow, config, "city");

  const phone = resolveField(rawRow, config, "phone");
  const telegram = normalizeTelegram(resolveField(rawRow, config, "telegram"));
  const email = resolveField(rawRow, config, "email");

  const description = resolveField(rawRow, config, "description");
  const portfolio = resolveField(rawRow, config, "portfolio");
  const payment = resolveField(rawRow, config, "payment");

  const comment = resolveField(rawRow, config, "comment");
  const review = resolveField(rawRow, config, "review");

  const title = resolveTitle(config, { name, company });
  if (!title) return null;

  return {
    id: createStableId(sheet, sourceRow),
    category: sheet.trim(),

    specialization,
    subspecialization,

    title,
    name,
    company,
    city,

    phone,
    telegram,
    email,

    description,
    portfolio,
    payment,

    comment,
    review,

    sourceSheet: sheet,
    sourceRow,
  };
}

export function mapSheetRows(
  sheet: PublishedSheetName,
  rows: RawRow[],
  firstDataRow = 2,
): DatabaseEntry[] {
  return rows
    .map((row, index) => mapSheetRow(sheet, firstDataRow + index, row))
    .filter((entry): entry is DatabaseEntry => entry !== null);
}

export function isPublishedSheet(
  sheetName: string,
): sheetName is PublishedSheetName {
  return Object.prototype.hasOwnProperty.call(SHEET_CONFIGS, sheetName);
}

export function getPublishedSheetNames(): PublishedSheetName[] {
  return [...PUBLISHED_SHEETS];
}

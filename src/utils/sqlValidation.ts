import sqlParser from 'node-sql-parser';
const { Parser } = sqlParser;

const parser = new Parser();
const allowedTables = new Set(['transactions', 'scraper_credentials']);

/**
 * Validates if a SQL query is a safe SELECT query
 */
// Regular expression to match PRAGMA table_info and index_list statements
const PRAGMA_REGEX = /PRAGMA\s+(?:table_info|index_list)\(['"]?([\w]+)['"]?\)/i;

export function validateSelectQuery(sql: string): { valid: boolean; reason?: string } {
  try {
    // Basic validation
    if (typeof sql !== 'string') {
      return { valid: false, reason: 'Query must be a string' };
    }

    const trimmedSql = sql.trim();
    if (!trimmedSql) {
      return { valid: false, reason: 'Empty query' };
    }

    // Check for unquoted semicolons (multiple statements)
    if (containsUnquotedSemicolon(trimmedSql)) {
      return { valid: false, reason: 'Multiple statements are not allowed' };
    }

    // Check for PRAGMA statements first
    const pragmaMatch = trimmedSql.match(PRAGMA_REGEX);
    if (pragmaMatch) {
      const tableName = pragmaMatch[1];
      if (!allowedTables.has(tableName)) {
        return {
          valid: false,
          reason: `Access to table not allowed in PRAGMA: ${tableName}`
        };
      }
      return { valid: true };
    }

    // For regular SELECT queries, extract table names from FROM clause
    const tableMatches = trimmedSql.match(/from\s+([\w]+)/gi) || [];
    const tables = tableMatches
      .map((match: string) => match.replace(/from\s+/i, '').trim())
      .filter(Boolean);

    const disallowedTables = tables.filter((t: string) => !allowedTables.has(t));
    if (disallowedTables.length > 0) {
      return {
        valid: false,
        reason: `Access to table(s) not allowed: ${disallowedTables.join(', ')}`
      };
    }

    // Additional validation with SQL parser
    try {
      const ast = parser.astify(trimmedSql, { database: 'SQLite' });
      
      // Handle case where multiple statements might be parsed
      if (Array.isArray(ast)) {
        return { valid: false, reason: 'Only one statement is allowed' };
      }

      // Must be a SELECT query (validated via AST)
      if (ast.type !== 'select') {
        return { valid: false, reason: 'Only SELECT statements are allowed' };
      }

      return { valid: true };
    } catch (parseError) {
      return { 
        valid: false, 
        reason: `Invalid SQL syntax: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` 
      };
    }
  } catch (error) {
    return { 
      valid: false, 
      reason: error instanceof Error ? error.message : 'Unknown error during validation' 
    };
  }
}

/**
 * Checks if a SQL string contains an unquoted semicolon
 * @param sql SQL string to check
 * @returns true if there's an unquoted semicolon, false otherwise
 */
function containsUnquotedSemicolon(sql: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prev = sql[i - 1];
    const next = sql[i + 1];

    if (inSingleQuote) {
      if (char === "'" && prev !== '\\') {
        if (next === "'") {
          // Escaped single quote in SQL (e.g., 'It''s fine')
          i++; // skip the escaped quote
        } else {
          inSingleQuote = false;
        }
      }
    } else if (inDoubleQuote) {
      if (char === '"' && prev !== '\\') {
        if (next === '"') {
          // Escaped double quote (e.g., "he said ""ok""")
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
    } else {
      if (char === "'" && prev !== '\\') {
        inSingleQuote = true;
      } else if (char === '"' && prev !== '\\') {
        inDoubleQuote = true;
      } else if (char === ';') {
        // Found an unquoted semicolon
        return true;
      }
    }
  }

  return false; // No unquoted semicolon found
}




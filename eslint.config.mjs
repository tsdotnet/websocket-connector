import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			"semi": "off",
			"indent": ["warn", "tab", { "SwitchCase": 1 }]
		},
		files: ['src/**/*.ts', 'tests/**/*.ts', '*.ts'],
			languageOptions: {
				parserOptions: {
					project: ['./tsconfig.json'],
					tsconfigRootDir: __dirname,
				}
			}
	}
);

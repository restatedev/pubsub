# Development Guidelines

## Build/Configuration Instructions

### Prerequisites

- **Package Manager**: This project uses `pnpm` (version 10.13.1+). Install with `npm install -g pnpm`
- **Node.js**: Compatible with Node.js (ES2022 target)
- **TypeScript**: Uses TypeScript 5.9.2+ with strict configuration

### Project Structure

This is a **pnpm monorepo** with the following packages:

- `packages/pubsub` - Main PubSub library
- `packages/pubsub-client` - Client library
- `packages/types` - Shared TypeScript types
- `packages/examples` - Usage examples
- `packages/tests` - Tests

### Build Process

1. **Install dependencies**: `pnpm install`
2. **Clean build**: `pnpm clean && pnpm build`
3. **Development mode**: `pnpm dev` (runs all packages in watch mode)
4. **Individual package build**: `pnpm --filter <package-name> build`

### Key Build Tools

- **tsdown**: Used for building packages with dual CJS/ESM output
- **API Extractor**: Validates exported APIs (`api-extractor run --local`)
- **attw**: Validates package exports (`attw --pack .`)
- **TypeScript**: Composite project setup with source maps and declaration maps

### Configuration Files

- `tsconfig.base.json`: Base TypeScript configuration (ES2022, NodeNext modules, strict mode)
- `pnpm-workspace.yaml`: Defines workspace packages and dependency catalog
- `vitest.base.config.ts`: Base testing configuration for all packages

## Testing Information

### Testing Framework

- **Vitest** is used as the testing framework with Node.js environment
- **Multi-project setup**: Tests run across all packages (`projects: ["packages/*"]`)
- **Global test functions**: `describe`, `it`, `expect` are available globally

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for specific package
pnpm --filter <package-name> test
```

### Test Configuration

- Test files: `*.test.ts` or `*.spec.ts`
- Tests are excluded from TypeScript compilation but run by Vitest
- Watch mode includes path aliases for local development:
  - `@restatedev/pubsub` → `./packages/pubsub/src/index.ts`
  - `@restatedev/pubsub-client` → `./packages/pubsub-client/src/index.ts`

### Adding New Tests

1. Add tests to `./packages/tests/src/pubsub.test.ts` following the structure of tests used there.

## Additional Development Information

### Code Style & Linting

- **ESLint**: Configured with TypeScript rules and unused imports plugin
- **Prettier**: Used for code formatting
- **Verification**: Run `pnpm verify` for complete validation (format, build, test, lint)

### Package Management

- **Workspace Dependencies**: Use `workspace:*` for internal package dependencies
- **Catalog Dependencies**: External dependencies managed via pnpm catalog in `pnpm-workspace.yaml`
- **Peer Dependencies**: Restate SDK components are peer dependencies

### Development Workflow

1. **Setup**: `pnpm install`
2. **Development**: `pnpm dev` (starts all packages in watch mode)
3. **Testing**: `pnpm test:watch` (continuous testing)
4. **Verification**: `pnpm verify` (complete validation before commit)

### Package Publishing

- **Changesets**: Used for version management (`pnpm changeset`)
- **Build Validation**: Each package validates exports with API Extractor and attw
- **Dual Output**: Packages build both CJS and ESM formats
- **Public Access**: Packages are published with public access

### Key Dependencies

- **Restate SDK**: Core dependency for durable execution
- **Zod**: Used for schema validation and serialization
- **Testcontainers**: Available for integration testing (pubsub-client)

### Development Commands

```bash
# Install dependencies (enforces pnpm usage)
pnpm install

# Clean all build artifacts
pnpm clean

# Build all packages
pnpm build

# Run in development mode (watch)
pnpm dev

# Run examples
pnpm examples

# Format code
pnpm format

# Check formatting
pnpm format-check

# Lint code
pnpm lint

# Full verification
pnpm verify
```

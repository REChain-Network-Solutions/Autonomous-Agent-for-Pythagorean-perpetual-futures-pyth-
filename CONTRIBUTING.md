# Contributing Guidelines

Thank you for your interest in contributing to the REChain Autonomous Agent for Pythagorean Perpetual Futures! We welcome contributions from the community and are committed to fostering an open and collaborative environment.

## 📋 Table of Contents
- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [Code Standards](#-code-standards)
- [Testing](#-testing)
- [Documentation](#-documentation)
- [Pull Request Process](#-pull-request-process)
- [Community](#-community)

## 📜 Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming and inclusive environment for all contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js >= 14.0.0
- npm or yarn
- Git

### Fork and Clone
1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-.git
   cd Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-
   ```

3. Add the original repository as upstream:
   ```bash
   git remote add upstream https://github.com/REChain-Network-Solutions/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-.git
   ```

### Install Dependencies
```bash
npm install
# or
yarn install
```

### Setup Development Environment
```bash
# Copy environment template
cp .env.example .env

# Configure your development settings
# Edit .env with your local configuration
```

## 🔧 Development Workflow

### Branch Naming
Use descriptive branch names following the pattern:
- `feature/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation updates
- `refactor/description` for code refactoring

### Keeping Your Fork Updated
```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

### Commit Messages
Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/modifications
- `chore`: Build process or auxiliary tool changes

**Example:**
```
feat(trading): add Pythagorean risk calculation module

- Implement geometric risk distribution
- Add unit tests for risk calculations
- Update documentation for new feature
```

## 🎨 Code Standards

### JavaScript/Node.js Standards
- Use ES6+ syntax where possible
- Follow Airbnb JavaScript Style Guide
- Use async/await for asynchronous operations
- Prefer const over let, avoid var
- Use descriptive variable and function names

### Linting
The project uses ESLint for code quality:
```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### File Structure
- Place new features in appropriate directories under `src/`
- Keep files focused and single-responsibility
- Use PascalCase for class names and camelCase for functions/variables
- Use descriptive file names that reflect their content

## 🧪 Testing

### Writing Tests
- Write tests for all new functionality
- Aim for high test coverage (>80%)
- Use descriptive test names that explain the behavior
- Test both happy paths and error cases

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/file.test.js

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Structure
```javascript
describe('Module Name', () => {
  describe('functionName()', () => {
    it('should do something when condition', () => {
      // Arrange
      const input = 'value';
      
      // Act
      const result = functionName(input);
      
      // Assert
      expect(result).toBe(expected);
    });
    
    it('should handle errors when invalid input', () => {
      // Test error cases
    });
  });
});
```

## 📚 Documentation

### Code Documentation
- Use JSDoc for function comments
- Document parameters, return values, and exceptions
- Keep comments updated with code changes

**Example:**
```javascript
/**
 * Calculates Pythagorean risk exposure for positions
 * @param {number} longPosition - Long position size
 * @param {number} shortPosition - Short position size
 * @returns {Object} Risk exposure object with long, short, and total risk
 * @throws {Error} If positions are invalid
 */
function calculateRiskExposure(longPosition, shortPosition) {
  // implementation
}
```

### Updating Documentation
- Update README.md for significant changes
- Add API documentation to api-doc.md
- Update OpenAPI specification for API changes
- Keep wiki.md current with new features

## 🔄 Pull Request Process

1. **Create a Branch**: Use descriptive branch name from your fork
2. **Make Changes**: Implement your feature or fix
3. **Add Tests**: Include comprehensive tests
4. **Update Documentation**: Ensure docs reflect changes
5. **Run Linting**: Fix any linting errors
6. **Test Thoroughly**: Verify all functionality works
7. **Submit PR**: Create pull request to upstream main branch

### PR Template
When creating a pull request, use the following template:

```markdown
## Description
Brief description of the changes made.

## Related Issues
Fixes #issue_number

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

## Testing
- [ ] Added tests
- [ ] Updated existing tests
- [ ] All tests pass

## Documentation
- [ ] Updated README
- [ ] Updated API documentation
- [ ] Updated wiki
- [ ] No documentation needed

## Checklist
- [ ] Code follows style guidelines
- [ ] Linting passes
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Branch is up to date with main
```

## 🤝 Community

### Getting Help
- Check the [wiki](../../wiki.md) for detailed documentation
- Review existing issues on GitHub
- Join our [Discord](https://discord.gg/rechain) for real-time discussion
- Participate in [Telegram](https://t.me/REChainDAO) conversations

### Reporting Issues
When reporting issues, include:
- Detailed description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)
- Relevant logs or error messages

### Feature Requests
For feature requests:
- Describe the use case clearly
- Explain the expected behavior
- Provide examples if possible
- Consider if it aligns with project goals

## 🎯 Contribution Areas

We welcome contributions in these areas:

### High Priority
- Bug fixes and stability improvements
- Performance optimizations
- Security enhancements
- Test coverage improvements

### Medium Priority
- New trading strategies
- Additional oracle integrations
- UI/UX improvements for analytics
- Documentation improvements

### Low Priority
- Experimental features
- Cosmetic changes
- Minor refactoring

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

## 🙏 Acknowledgments

We appreciate all contributions, whether they're code, documentation, bug reports, or feature suggestions. Every contribution helps make this project better.

---

**Thank you for contributing to decentralized autonomous finance!** 🚀

*REChain Network Solutions - Building the future of automated trading*
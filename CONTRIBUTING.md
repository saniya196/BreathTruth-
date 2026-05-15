# Contributing to BreathTruth

Thank you for your interest in contributing to BreathTruth! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/BreathTruth-.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Set up development environment (see [SETUP.md](docs/SETUP.md))

## Development Workflow

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

Example: `git checkout -b feature/add-export-functionality`

### Before Committing

1. Run tests (if available)
2. Check code formatting
3. Verify no console errors
4. Test in both development and production mode

### Commit Message Format

```
feat: Add new AQI alert notification feature
fix: Resolve CORS issue with API calls
docs: Update deployment guide
refactor: Simplify aggregation logic
test: Add unit tests for alert service
```

## Pull Request Process

1. Create a Pull Request with a clear title and description
2. Link any related issues (e.g., "Fixes #42")
3. Provide screenshots if UI changes
4. Wait for review and feedback
5. Address any requested changes
6. Merge once approved

### PR Description Template

```markdown
## What does this PR do?
[Brief description of changes]

## Why these changes?
[Motivation and context]

## Testing
[How to test the changes]

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] Changes are well-commented
- [ ] No breaking changes introduced
- [ ] Backend/Frontend tested locally
- [ ] Documentation updated
```

## Reporting Bugs

1. Check existing issues first
2. Provide clear title and description
3. Include steps to reproduce
4. Share relevant environment info (OS, Node version, browser)
5. Attach logs or screenshots if applicable

## Feature Requests

1. Check existing issues/discussions
2. Clearly describe the feature
3. Explain the use case and benefits
4. Suggest implementation approach if possible

## Code Style Guide

### Backend (Node.js/Express)

- Use `const` by default, `let` when reassignment needed
- Function naming: `camelCase`
- File naming: `camelCase.js`
- Use meaningful variable names
- Add comments for complex logic

```javascript
// ✅ Good
const fetchOfficialAqi = async (stationId) => {
  // Implementation
};

// ❌ Avoid
const fetch_AQI = async (sid) => {
  // Implementation
};
```

### Frontend (React)

- Use functional components with hooks
- Component naming: `PascalCase`
- File naming: `ComponentName.js` or `kebab-case.js`
- Keep components focused and reusable
- Extract magic numbers to constants

```jsx
// ✅ Good
const AqiCard = ({ title, value }) => {
  return <div className="card">{value}</div>;
};

// ❌ Avoid
const aqi_card = (props) => {
  return <div>{props.val}</div>;
};
```

## Documentation

- Update README.md for new features
- Add JSDoc comments for functions
- Include examples for complex implementations
- Keep docs in sync with code

```javascript
/**
 * Fetches official AQI data from CPCB or WAQI fallback
 * @param {string} stationId - The station identifier
 * @returns {Promise<Object>} Official AQI data with metadata
 */
const fetchOfficialAqi = async (stationId) => {
  // Implementation
};
```

## Testing

When adding new features:

1. Test all user flows locally
2. Test edge cases
3. Verify error handling
4. Check console for warnings/errors
5. Test on different screen sizes (frontend)
6. Test with sample data

## Performance

- Keep API responses lean
- Optimize database queries (use indexes)
- Lazy load components when possible
- Minimize bundle size
- Cache when appropriate

## Security

- Never commit `.env` files or secrets
- Validate all user inputs
- Sanitize data before storing
- Use environment variables for sensitive config
- Report security issues privately

## Questions?

- Check existing documentation in `/docs`
- Open a GitHub Discussion
- Create an issue for bugs
- Contact maintainers for clarification

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions. Harassment or discrimination will not be tolerated.

---

**Thank you for contributing to BreathTruth! 🌍**

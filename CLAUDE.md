# Swankdown

## Bug-fixing workflow

When a bug is filed:

1. Write a test that reproduces the bug (it should fail)
2. Run the test to confirm it fails
3. Fix the bug
4. Run the test again to confirm it passes
5. Leave the test in place as a regression guard

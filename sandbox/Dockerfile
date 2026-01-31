# Secure Python sandbox for code execution
FROM python:3.11-slim

# Create non-root user for security
RUN useradd -m -s /bin/bash sandbox

# Install common Python packages for tutorials
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    requests \
    beautifulsoup4 \
    flask \
    sqlalchemy \
    pytest \
    typing-extensions

# Set resource limits
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create working directory
WORKDIR /code
RUN chown sandbox:sandbox /code

# Switch to non-root user
USER sandbox

# Default command
CMD ["python3"]

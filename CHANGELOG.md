# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2017-06-04
### Added
- Changelog
- getItems method
- Auto timeout in case limit watcher is not manually set
- Query method
- Scan method

### Changed
- S3 getObject will return null if key is not found
- Change to return type of getItem
- Readme

## [1.0.0] - 2017-06-02
### Added
- S3 getObject and putObject wrapper
- DynamoDB auto-limit controller
- Lambda invoke function
var gulp = require('gulp'),
    mocha = require('gulp-mocha'),
    jshint = require('gulp-jshint'),
    stylish = require('jshint-stylish'),
    testFile = 'test/**/*.test.js',
    scriptFiles = 'lib/**/*.js';

gulp.task('test', ['lint'], function () {
    gulp.src(testFile)
        .pipe(mocha({reporter: 'nyan'}));
});

gulp.task('lint', function () {
    return gulp.src(scriptFiles)
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
});

gulp.task('default', ['test']);
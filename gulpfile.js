let gulp = require('gulp');
let concat = require('gulp-concat');
let wrap = require('gulp-wrap');
let uglify = require('gulp-uglify');
let htmlmin = require('gulp-htmlmin');
let gulpif = require('gulp-if');
let sass = require('gulp-sass');
let yargs = require('yargs');
let ngAnnotate = require('gulp-ng-annotate');
let templateCache = require('gulp-angular-templatecache');
let server = require('browser-sync');
let del = require('del');
let path = require('path');
let child = require('child_process');
let Dgeni = require('dgeni');

const exec = child.exec;
const argv = yargs.argv;
const root = 'src/';
const paths = {
  dist: './dist/',
  distDocs: './docs/build',
  docs: './docs/app/*.js',
  scripts: [`${root}/app/**/*.js`, `!${root}/app/**/*.spec.js`],
  tests: `${root}/app/**/*.spec.js`,
  styles: `${root}/sass/*.scss`,
  templates: `${root}/app/**/*.html`,
  modules: [
    'angular/angular.js',
    'angular-ui-router/release/angular-ui-router.js',
    'firebase/firebase.js',
    'angularfire/dist/angularfire.js',
    'angular-loading-bar/build/loading-bar.min.js'
  ],
  static: [
    `${root}/index.html`,
    `${root}/fonts/**/*`,
    `${root}/img/**/*`
  ]
};

server.create();

gulp.task('clean', cb => del(paths.dist + '**/*', cb));

gulp.task('cleanDocs', cb => del(paths.distDocs + '**/**/*', cb));

gulp.task('templates', () => {
  return gulp.src(paths.templates)
    .pipe(htmlmin({ collapseWhitespace: true }))
    .pipe(templateCache({
      root: 'app',
      standalone: true,
      transformUrl: function (url) {
        return url.replace(path.dirname(url), '.');
      }
    }))
    .pipe(gulp.dest('./'));
});

gulp.task('modules', ['templates'], () => {
  return gulp.src(paths.modules.map(item => 'node_modules/' + item))
    .pipe(concat('vendor.js'))
    .pipe(gulpif(argv.deploy, uglify()))
    .pipe(gulp.dest(paths.dist + 'js/'));
});

gulp.task('styles', () => {
  return gulp.src(paths.styles)
    .pipe(sass({outputStyle: 'compressed'}))
    .pipe(gulp.dest(paths.dist + 'css/'));
});

gulp.task('scripts', ['modules'], () => {
  return gulp.src([
      `!${root}/app/**/*.spec.js`,
      `${root}/app/**/*.module.js`,
      ...paths.scripts,
      './templates.js'
    ])
    .pipe(wrap('(function(angular){\n\'use strict\';\n<%= contents %>})(window.angular);'))
    .pipe(concat('bundle.js'))
    .pipe(ngAnnotate())
    .pipe(gulpif(argv.deploy, uglify()))
    .pipe(gulp.dest(paths.dist + 'js/'));
});

gulp.task('serve', () => {
  return server.init({
    files: [`${paths.dist}/**`],
    port: 4000,
    server: {
      baseDir: paths.dist
    }
  });
});

gulp.task('copy', ['clean'], () => {
  return gulp.src(paths.static, { base: 'src' })
    .pipe(gulp.dest(paths.dist));
});

gulp.task('watch', ['serve', 'scripts'], () => {
  gulp.watch([paths.scripts, paths.templates], ['scripts']);
  gulp.watch(paths.styles, ['styles']);
});

gulp.task('firebase', ['styles', 'scripts'], cb => {
  return exec('firebase deploy', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('default', [
  'copy',
  'styles',
  'serve',
  'watch'
]);

gulp.task('production', [
  'copy',
  'scripts',
  'firebase'
]);

gulp.task('copyDocs', () => {
  return gulp.src(paths.docs)
    .pipe(gulp.dest(paths.distDocs + '/src'));
});

gulp.task('dgeni', ['cleanDocs', 'copyDocs'], () => {
    var dgeni = new Dgeni([require('./docs/config')]);
    return dgeni.generate();
});
